import { requireRestaurantAccess } from "../security/authorization.js";
export function createInventoryController(app, env) {
    const get_api_restaurants_restaurantId_stock_locations = async (request, reply) => {
        const access = await requireInventoryAccess(app, request, reply, env);
        if (!access)
            return;
        const result = await app.db.query(`select id, restaurant_id, name, is_default, active, created_at
         from stock_locations where restaurant_id = $1
         order by is_default desc, name`, [access.restaurantId]);
        return reply.send({ ok: true, locations: result.rows });
    };
    const post_api_restaurants_restaurantId_stock_locations = async (request, reply) => {
        const access = await requireRestaurantAccess(request, reply, env, request.params.restaurantId, ["owner"]);
        if (!access)
            return;
        const name = request.body?.name?.trim() ?? "";
        if (!name || name.length > 200)
            return invalidBody(reply);
        const client = await app.db.connect();
        try {
            await client.query("begin");
            if (request.body?.is_default) {
                await client.query("update stock_locations set is_default = false where restaurant_id = $1", [access.restaurantId]);
            }
            const result = await client.query(`insert into stock_locations (restaurant_id, name, is_default)
         values ($1,$2,$3) returning *`, [access.restaurantId, name, request.body?.is_default ?? false]);
            await client.query("commit");
            return reply.status(201).send({ ok: true, location: result.rows[0] });
        }
        catch (error) {
            await client.query("rollback");
            if (isUniqueViolation(error)) {
                return reply.status(409).send({ ok: false, error: "LOCATION_EXISTS" });
            }
            throw error;
        }
        finally {
            client.release();
        }
    };
    const get_api_restaurants_restaurantId_stock_items = async (request, reply) => {
        const access = await requireInventoryAccess(app, request, reply, env);
        if (!access)
            return;
        const locationId = request.query.locationId ?? null;
        if (locationId && !isUuid(locationId))
            return invalidId(reply);
        const result = await app.db.query(`select i.id, i.restaurant_id, i.name, i.sku, i.barcode, i.unit,
              i.minimum_stock, i.track_stock, i.allow_negative, i.active,
              i.image_url, i.created_at, i.updated_at,
              coalesce(sum(b.quantity) filter (
                where $2::uuid is null or b.location_id = $2
              ), 0)::text as quantity
       from inventory_items i
       left join inventory_balances b on b.inventory_item_id = i.id
       where i.restaurant_id = $1
       group by i.id
       having (
         $3::boolean = false
         or coalesce(sum(b.quantity) filter (
           where $2::uuid is null or b.location_id = $2
         ), 0) <= i.minimum_stock
       )
       order by i.active desc, i.name`, [
            access.restaurantId,
            locationId,
            request.query.lowStock === "true",
        ]);
        return reply.send({ ok: true, items: result.rows });
    };
    const post_api_restaurants_restaurantId_stock_items = async (request, reply) => {
        const access = await requireRestaurantAccess(request, reply, env, request.params.restaurantId, ["owner"]);
        if (!access)
            return;
        const body = request.body ?? {};
        const name = body.name?.trim() ?? "";
        const unit = body.unit?.trim() || "piece";
        if (!name ||
            name.length > 200 ||
            !unit ||
            unit.length > 50 ||
            (body.minimum_stock !== undefined &&
                (!Number.isFinite(body.minimum_stock) || body.minimum_stock < 0))) {
            return invalidBody(reply);
        }
        try {
            const result = await app.db.query(`insert into inventory_items
          (restaurant_id, name, sku, barcode, unit, minimum_stock,
           track_stock, allow_negative, image_url)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         returning *`, [
                access.restaurantId,
                name,
                cleanText(body.sku),
                cleanText(body.barcode),
                unit,
                body.minimum_stock ?? 0,
                body.track_stock ?? true,
                body.allow_negative ?? false,
                cleanText(body.image_url),
            ]);
            return reply.status(201).send({ ok: true, item: result.rows[0] });
        }
        catch (error) {
            if (isUniqueViolation(error)) {
                return reply.status(409).send({ ok: false, error: "SKU_OR_BARCODE_EXISTS" });
            }
            throw error;
        }
    };
    const patch_api_restaurants_restaurantId_stock_items_itemId = async (request, reply) => {
        if (!isUuid(request.params.itemId))
            return invalidId(reply);
        const access = await requireRestaurantAccess(request, reply, env, request.params.restaurantId, ["owner"]);
        if (!access)
            return;
        const body = request.body ?? {};
        if ((body.name !== undefined && !body.name.trim()) ||
            (body.unit !== undefined && !body.unit.trim()) ||
            (body.minimum_stock !== undefined &&
                (!Number.isFinite(body.minimum_stock) || body.minimum_stock < 0))) {
            return invalidBody(reply);
        }
        try {
            const result = await app.db.query(`update inventory_items set
           name = coalesce($3, name),
           sku = case when $4::boolean then $5 else sku end,
           barcode = case when $6::boolean then $7 else barcode end,
           unit = coalesce($8, unit),
           minimum_stock = coalesce($9, minimum_stock),
           track_stock = coalesce($10, track_stock),
           allow_negative = coalesce($11, allow_negative),
           active = coalesce($12, active),
           image_url = case when $13::boolean then $14 else image_url end
         where id = $1 and restaurant_id = $2
         returning *`, [
                request.params.itemId,
                access.restaurantId,
                body.name?.trim() ?? null,
                "sku" in body,
                cleanText(body.sku),
                "barcode" in body,
                cleanText(body.barcode),
                body.unit?.trim() ?? null,
                body.minimum_stock ?? null,
                body.track_stock ?? null,
                body.allow_negative ?? null,
                body.active ?? null,
                "image_url" in body,
                cleanText(body.image_url),
            ]);
            if (!result.rows[0])
                return notFound(reply);
            return reply.send({ ok: true, item: result.rows[0] });
        }
        catch (error) {
            if (isUniqueViolation(error)) {
                return reply.status(409).send({ ok: false, error: "SKU_OR_BARCODE_EXISTS" });
            }
            throw error;
        }
    };
    const get_api_restaurants_restaurantId_stock_movements = async (request, reply) => {
        const access = await requireInventoryAccess(app, request, reply, env);
        if (!access)
            return;
        const itemId = request.query.itemId ?? null;
        if (itemId && !isUuid(itemId))
            return invalidId(reply);
        const parsedLimit = Number(request.query.limit ?? 200);
        const limit = Number.isSafeInteger(parsedLimit)
            ? Math.min(Math.max(parsedLimit, 1), 500)
            : 200;
        const result = await app.db.query(`select m.*, i.name as item_name, i.unit, l.name as location_name, coalesce(u.display_name, u.email) as actor_name
       from stock_movements m
       join inventory_items i on i.id = m.inventory_item_id
       join stock_locations l on l.id = m.location_id
       left join app_users u on u.id = m.actor_user_id
       where m.restaurant_id = $1
         and ($2::uuid is null or m.inventory_item_id = $2)
       order by m.occurred_at desc, m.created_at desc
       limit $3`, [access.restaurantId, itemId, limit]);
        return reply.send({ ok: true, movements: result.rows });
    };
    const post_api_restaurants_restaurantId_stock_movements = async (request, reply) => {
        const access = await requireRestaurantAccess(request, reply, env, request.params.restaurantId, ["owner", "staff", "cook"]);
        if (!access)
            return;
        const body = request.body ?? {};
        const itemId = body.inventory_item_id ?? "";
        const locationId = body.location_id ?? "";
        const type = body.movement_type ?? "";
        const quantity = body.quantity;
        if (!isUuid(itemId) ||
            !isUuid(locationId) ||
            !isManualMovementType(type) ||
            !Number.isFinite(quantity) ||
            quantity === 0 ||
            !movementSignIsValid(type, quantity) ||
            (body.unit_cost != null && (!Number.isFinite(body.unit_cost) || body.unit_cost < 0)) ||
            (body.note?.length ?? 0) > 500 ||
            (body.idempotency_key?.length ?? 0) > 100) {
            return invalidBody(reply);
        }
        try {
            const result = await app.db.query(`insert into stock_movements
          (restaurant_id, inventory_item_id, location_id, movement_type,
           quantity_delta, unit_cost, idempotency_key, note, actor_user_id)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         returning *`, [
                access.restaurantId,
                itemId,
                locationId,
                type,
                quantity,
                body.unit_cost ?? null,
                cleanText(body.idempotency_key),
                cleanText(body.note),
                access.user.id,
            ]);
            return reply.status(201).send({ ok: true, movement: result.rows[0] });
        }
        catch (error) {
            if (isDatabaseMessage(error, "INSUFFICIENT_STOCK")) {
                return reply.status(409).send({ ok: false, error: "INSUFFICIENT_STOCK" });
            }
            if (isDatabaseMessage(error, "INVENTORY_RESTAURANT_MISMATCH")) {
                return reply.status(400).send({ ok: false, error: "INVALID_INVENTORY_REFERENCE" });
            }
            if (isUniqueViolation(error) && body.idempotency_key) {
                return reply.status(409).send({ ok: false, error: "DUPLICATE_MOVEMENT" });
            }
            throw error;
        }
    };
    const get_api_restaurants_restaurantId_menu_inventory_components = async (request, reply) => {
        const access = await requireInventoryAccess(app, request, reply, env);
        if (!access)
            return;
        const result = await app.db.query(`select c.menu_id, c.inventory_item_id, c.quantity::text,
                m.name as menu_name, i.name as inventory_item_name, i.unit
         from menu_inventory_components c
         join menus m on m.id = c.menu_id
         join inventory_items i on i.id = c.inventory_item_id
         where m.restaurant_id = $1 and i.restaurant_id = $1
         order by m.name, i.name`, [access.restaurantId]);
        return reply.send({ ok: true, components: result.rows });
    };
    const put_api_restaurants_restaurantId_menus_menuId_inventory_components = async (request, reply) => {
        if (!isUuid(request.params.menuId))
            return invalidId(reply);
        const access = await requireRestaurantAccess(request, reply, env, request.params.restaurantId, ["owner"]);
        if (!access)
            return;
        const components = request.body?.components;
        if (!Array.isArray(components) ||
            components.length > 100 ||
            components.some((component) => !isUuid(component.inventory_item_id ?? "") ||
                !Number.isFinite(component.quantity) ||
                component.quantity <= 0)) {
            return invalidBody(reply);
        }
        const client = await app.db.connect();
        try {
            await client.query("begin");
            const menu = await client.query("select 1 from menus where id = $1 and restaurant_id = $2 for update", [request.params.menuId, access.restaurantId]);
            if (!menu.rows[0]) {
                await client.query("rollback");
                return notFound(reply);
            }
            const itemIds = components.map((component) => component.inventory_item_id);
            if (itemIds.length) {
                const validItems = await client.query(`select id from inventory_items
           where restaurant_id = $1 and id = any($2::uuid[])`, [access.restaurantId, itemIds]);
                if (new Set(validItems.rows.map((row) => row.id)).size !== new Set(itemIds).size) {
                    await client.query("rollback");
                    return reply.status(400).send({ ok: false, error: "INVALID_INVENTORY_ITEM" });
                }
            }
            await client.query("delete from menu_inventory_components where menu_id = $1", [request.params.menuId]);
            for (const component of components) {
                await client.query(`insert into menu_inventory_components
            (menu_id, inventory_item_id, quantity)
           values ($1,$2,$3)`, [
                    request.params.menuId,
                    component.inventory_item_id,
                    component.quantity,
                ]);
            }
            await client.query("commit");
            return reply.send({ ok: true, components });
        }
        catch (error) {
            await client.query("rollback");
            throw error;
        }
        finally {
            client.release();
        }
    };
    return { get_api_restaurants_restaurantId_stock_locations, post_api_restaurants_restaurantId_stock_locations, get_api_restaurants_restaurantId_stock_items, post_api_restaurants_restaurantId_stock_items, patch_api_restaurants_restaurantId_stock_items_itemId, get_api_restaurants_restaurantId_stock_movements, post_api_restaurants_restaurantId_stock_movements, get_api_restaurants_restaurantId_menu_inventory_components, put_api_restaurants_restaurantId_menus_menuId_inventory_components };
}
async function requireInventoryAccess(_app, request, reply, env) {
    if (!isUuid(request.params.restaurantId)) {
        invalidId(reply);
        return null;
    }
    return requireRestaurantAccess(request, reply, env, request.params.restaurantId);
}
function isManualMovementType(value) {
    return [
        "opening",
        "purchase",
        "waste",
        "adjustment",
        "return_in",
        "return_out",
    ].includes(value);
}
function movementSignIsValid(type, quantity) {
    if (["opening", "purchase", "return_in"].includes(type))
        return quantity > 0;
    if (["waste", "return_out"].includes(type))
        return quantity < 0;
    return type === "adjustment";
}
function cleanText(value) {
    if (value == null)
        return null;
    return value.trim() || null;
}
function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
function isUniqueViolation(error) {
    return (typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "23505");
}
function isDatabaseMessage(error, message) {
    return error instanceof Error && error.message.includes(message);
}
function invalidId(reply) {
    return reply.status(400).send({ ok: false, error: "INVALID_ID" });
}
function invalidBody(reply) {
    return reply.status(400).send({ ok: false, error: "INVALID_BODY" });
}
function notFound(reply) {
    return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
}
