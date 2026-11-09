import { requireRestaurantAccess } from "../security/authorization.js";
export function createStockDepositsController(app, env) {
    const expireOverdue = async (restaurantId) => app.db.query(`update stock_deposits
      set status = 'expired', expired_at = now(), updated_at = now()
      where status = 'pending'
        and due_date < (now() at time zone 'Asia/Vientiane')::date
        and ($1::uuid is null or restaurant_id = $1)`, [restaurantId ?? null]);
    const list = async (request, reply) => {
        const access = await requireRestaurantAccess(request, reply, env, request.params.restaurantId);
        if (!access)
            return;
        await expireOverdue(access.restaurantId);
        const result = await app.db.query(`select id, customer_name, customer_contact,
        product_name, inventory_item_id, quantity::text, unit, meal_count, due_date::text, note, status,
        expiry_resolution, expiry_resolved_by, expiry_resolved_at,
        created_by, picked_up_by, picked_up_at, expired_at, created_at
      from stock_deposits where restaurant_id = $1
      order by case status when 'pending' then 0 when 'expired' then 1 else 2 end,
        due_date asc, created_at desc limit 1000`, [access.restaurantId]);
        return reply.send({ ok: true, deposits: result.rows });
    };
    const create = async (request, reply) => {
        const access = await requireRestaurantAccess(request, reply, env, request.params.restaurantId);
        if (!access)
            return;
        const body = request.body ?? {};
        const customerName = cleanText(body.customer_name);
        const customerContact = cleanText(body.customer_contact);
        const productName = cleanText(body.product_name);
        const inventoryItemId = cleanText(body.inventory_item_id);
        const unit = cleanText(body.unit);
        const note = cleanText(body.note);
        const quantity = Number(body.quantity);
        const mealCount = body.meal_count == null || body.meal_count === "" ? null : Number(body.meal_count);
        const dueDate = mealCount == null || !Number.isInteger(mealCount) || mealCount < 1 || mealCount > 10000
            ? body.due_date
            : dateAfterMeals(businessDate(), mealCount - 1);
        if (!customerName || customerName.length > 160 || (customerContact?.length ?? 0) > 100 ||
            !productName || productName.length > 200 || (inventoryItemId && !isUuid(inventoryItemId)) || !unit || unit.length > 40 ||
            !Number.isFinite(quantity) || quantity <= 0 || quantity > 1_000_000_000 ||
            (mealCount != null && (!Number.isInteger(mealCount) || mealCount < 1 || mealCount > 10000)) ||
            !isDate(dueDate) || dueDate < businessDate() || (note?.length ?? 0) > 1000) {
            return reply.status(400).send({ ok: false, error: "INVALID_BODY" });
        }
        if (inventoryItemId) {
            const item = await app.db.query("select id, unit from inventory_items where id=$1 and restaurant_id=$2", [inventoryItemId, access.restaurantId]);
            if (!item.rowCount)
                return reply.status(400).send({ ok: false, error: "INVALID_INVENTORY_REFERENCE" });
            if (item.rows[0].unit !== unit)
                return reply.status(400).send({ ok: false, error: "INVENTORY_UNIT_MISMATCH" });
        }
        const result = await app.db.query(`insert into stock_deposits
      (restaurant_id, customer_name, customer_contact, product_name, inventory_item_id, quantity, unit, meal_count, due_date, note, created_by)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      returning id, customer_name, customer_contact, product_name, quantity::text,
        inventory_item_id, unit, meal_count, due_date::text, note, status, expiry_resolution, created_by, picked_up_by, picked_up_at,
        expired_at, created_at`, [access.restaurantId, customerName, customerContact,
            productName, inventoryItemId, quantity, unit, mealCount, dueDate, note, access.user.id]);
        return reply.status(201).send({ ok: true, deposit: result.rows[0] });
    };
    const pickup = async (request, reply) => {
        const access = await requireRestaurantAccess(request, reply, env, request.params.restaurantId);
        if (!access)
            return;
        if (!isUuid(request.params.depositId))
            return reply.status(400).send({ ok: false, error: "INVALID_ID" });
        const client = await app.db.connect();
        try {
            await client.query("begin");
            await client.query(`update stock_deposits set status='expired', expired_at=now(), updated_at=now()
        where restaurant_id=$1 and id=$2 and status='pending'
          and due_date < (now() at time zone 'Asia/Vientiane')::date`, [access.restaurantId, request.params.depositId]);
            const result = await client.query(`update stock_deposits set status='picked_up',
          picked_up_by=$3, picked_up_at=now(), updated_at=now()
        where restaurant_id=$1 and id=$2 and status='pending' returning id, status, picked_up_at`, [access.restaurantId, request.params.depositId, access.user.id]);
            if (!result.rowCount) {
                const existing = await client.query("select status from stock_deposits where restaurant_id=$1 and id=$2", [access.restaurantId, request.params.depositId]);
                await client.query("commit");
                if (!existing.rowCount)
                    return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
                return reply.status(409).send({ ok: false, error: existing.rows[0].status === "expired" ? "DEPOSIT_EXPIRED" : "DEPOSIT_ALREADY_CLOSED" });
            }
            await client.query("commit");
            return reply.send({ ok: true, deposit: result.rows[0] });
        }
        catch (error) {
            await client.query("rollback");
            throw error;
        }
        finally {
            client.release();
        }
    };
    const resolveExpiry = async (request, reply) => {
        const access = await requireRestaurantAccess(request, reply, env, request.params.restaurantId, ["owner", "staff", "cook", "waiter"]);
        if (!access)
            return;
        if (!isUuid(request.params.depositId))
            return reply.status(400).send({ ok: false, error: "INVALID_ID" });
        const action = request.body?.action;
        const itemId = cleanText(request.body?.inventory_item_id);
        if (!["add_to_stock", "discard"].includes(action) || (itemId && !isUuid(itemId))) {
            return reply.status(400).send({ ok: false, error: "INVALID_BODY" });
        }
        const client = await app.db.connect();
        try {
            await client.query("begin");
            const locked = await client.query("select * from stock_deposits where restaurant_id=$1 and id=$2 for update", [access.restaurantId, request.params.depositId]);
            if (!locked.rowCount) {
                await client.query("rollback");
                return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
            }
            const deposit = locked.rows[0];
            if (deposit.status === "pending" && deposit.due_date < businessDate()) {
                await client.query("update stock_deposits set status='expired', expired_at=now(), updated_at=now() where id=$1", [deposit.id]);
                deposit.status = "expired";
            }
            if (deposit.status !== "expired") {
                await client.query("rollback");
                return reply.status(409).send({ ok: false, error: "DEPOSIT_NOT_EXPIRED" });
            }
            const resolution = action === "add_to_stock" ? "added_to_stock" : "discarded";
            if (deposit.expiry_resolution) {
                await client.query("commit");
                if (deposit.expiry_resolution !== resolution)
                    return reply.status(409).send({ ok: false, error: "DEPOSIT_ALREADY_RESOLVED" });
                return reply.send({ ok: true, deposit: { id: deposit.id, expiry_resolution: deposit.expiry_resolution } });
            }
            if (action === "add_to_stock") {
                const targetItemId = itemId || deposit.inventory_item_id;
                if (!targetItemId) {
                    await client.query("rollback");
                    return reply.status(400).send({ ok: false, error: "INVENTORY_ITEM_REQUIRED" });
                }
                const item = await client.query("select id, unit from inventory_items where id=$1 and restaurant_id=$2 and active=true", [targetItemId, access.restaurantId]);
                if (!item.rowCount) {
                    await client.query("rollback");
                    return reply.status(400).send({ ok: false, error: "INVALID_INVENTORY_REFERENCE" });
                }
                if (item.rows[0].unit !== deposit.unit) {
                    await client.query("rollback");
                    return reply.status(400).send({ ok: false, error: "INVENTORY_UNIT_MISMATCH" });
                }
                const location = await client.query(`select id from stock_locations
          where restaurant_id=$1 and active=true order by is_default desc, created_at asc limit 1`, [access.restaurantId]);
                if (!location.rowCount) {
                    await client.query("rollback");
                    return reply.status(409).send({ ok: false, error: "NO_STOCK_LOCATION" });
                }
                await client.query(`insert into stock_movements
          (restaurant_id, inventory_item_id, location_id, movement_type, quantity_delta,
           reference_type, reference_id, idempotency_key, note, actor_user_id)
          values ($1,$2,$3,'return_in',$4,'stock_deposit_expiry',$5,$6,$7,$8)
          on conflict (restaurant_id,idempotency_key) where idempotency_key is not null do nothing`, [access.restaurantId, targetItemId, location.rows[0].id, deposit.quantity, deposit.id,
                    `stock-deposit-expiry:${deposit.id}`, `รับเข้าสต๊อกจากสินค้าฝากหมดกำหนด (${deposit.customer_name})`, access.user.id]);
                await client.query(`update stock_deposits set inventory_item_id=$2, expiry_resolution='added_to_stock',
          expiry_resolved_by=$3, expiry_resolved_at=now(), updated_at=now() where id=$1`, [deposit.id, targetItemId, access.user.id]);
            }
            else {
                await client.query(`update stock_deposits set expiry_resolution='discarded',
          expiry_resolved_by=$2, expiry_resolved_at=now(), updated_at=now() where id=$1`, [deposit.id, access.user.id]);
            }
            await client.query("commit");
            return reply.send({ ok: true, deposit: { id: deposit.id, expiry_resolution: resolution } });
        }
        catch (error) {
            await client.query("rollback");
            throw error;
        }
        finally {
            client.release();
        }
    };
    return { list, create, pickup, resolveExpiry, expireOverdue };
}
function cleanText(value) {
    return typeof value === "string" ? value.trim() || null : null;
}
function isDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
        return false;
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}
function businessDate() {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Vientiane", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
}
function dateAfterMeals(startDate, daysAfter) {
    const [year, month, day] = startDate.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day + daysAfter)).toISOString().slice(0, 10);
}
function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
