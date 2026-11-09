function normalizeTableLabel(value) { if (typeof value === 'number')
    return Number.isSafeInteger(value) && value > 0 ? String(value) : null; if (typeof value !== 'string')
    return null; const label = value.trim(); return label.length > 0 && label.length <= 30 && !/[\x00-\x1f\x7f]/.test(label) ? label : null; }
import { requireRestaurantAccess } from "../security/authorization.js";
import { randomBytes } from "node:crypto";
import { registerMenuStockAdjustment } from "../routes/menu-stock-adjustment.js";
import { registerMenuStockTransfer } from "../routes/menu-stock-transfer.js";
import { registerMenuStockHistory } from "../routes/menu-stock-history.js";
import { registerMenuStockOutgoing } from "../routes/menu-stock-outgoing.js";
export function createManagementController(app, env) {
    const get_api_restaurants_restaurantId = async (request, reply) => {
        if (!isUuid(request.params.restaurantId))
            return invalidId(reply);
        const access = await requireRestaurantAccess(request, reply, env, request.params.restaurantId);
        if (!access)
            return;
        const result = await app.db.query(`select id, user_id, name, currency_code, accepting_orders, open_time, close_time,
                service_charge_pct, vat_pct, payment_qr_url,
                kitchen_print_width, created_at
         from restaurants where id = $1`, [access.restaurantId]);
        return reply.send({
            ok: true,
            restaurant: result.rows[0],
            role: access.role,
        });
    };
    const patch_api_restaurants_restaurantId = async (request, reply) => {
        if (!isUuid(request.params.restaurantId))
            return invalidId(reply);
        const access = await requireRestaurantAccess(request, reply, env, request.params.restaurantId, ["owner"]);
        if (!access)
            return;
        const body = request.body ?? {};
        const name = body.name?.trim();
        if (name !== undefined && (name.length === 0 || name.length > 200)) {
            return invalidBody(reply);
        }
        if ((body.service_charge_pct !== undefined && !validPercentage(body.service_charge_pct)) ||
            (body.vat_pct !== undefined && !validPercentage(body.vat_pct))) {
            return invalidBody(reply);
        }
        if (body.kitchen_print_width !== undefined &&
            ![58, 76, 80].includes(body.kitchen_print_width)) {
            return invalidBody(reply);
        }
        const result = await app.db.query(`update restaurants set
         name = coalesce($2, name),
         accepting_orders = coalesce($3, accepting_orders),
         open_time = case when $4::boolean then $5 else open_time end,
         close_time = case when $6::boolean then $7 else close_time end,
         service_charge_pct = coalesce($8, service_charge_pct),
         vat_pct = coalesce($9, vat_pct),
         payment_qr_url = case when $10::boolean then $11 else payment_qr_url end,
         kitchen_print_width = coalesce($12, kitchen_print_width)
       where id = $1
       returning *`, [
            access.restaurantId,
            name ?? null,
            body.accepting_orders ?? null,
            "open_time" in body,
            body.open_time ?? null,
            "close_time" in body,
            body.close_time ?? null,
            body.service_charge_pct ?? null,
            body.vat_pct ?? null,
            "payment_qr_url" in body,
            body.payment_qr_url ?? null,
            body.kitchen_print_width ?? null,
        ]);
        return reply.send({ ok: true, restaurant: result.rows[0] });
    };
    const get_api_restaurants_restaurantId_dashboard_summary = async (request, reply) => {
        const access = await accessAny(app, request, reply, env);
        if (!access)
            return;
        const [summary, recent] = await Promise.all([
            app.db.query(`select
             coalesce((select sum(total) from orders
               where restaurant_id = $1 and paid = true
                 and paid_at >= current_date), 0)::text as today_revenue,
             (select count(*) from orders where restaurant_id = $1
               and paid = true and paid_at >= current_date)::text as today_paid_count,
             (select count(*) from orders where restaurant_id = $1
               and status = 'pending' and created_at >= current_date)::text as pending_count,
             (select count(*) from orders where restaurant_id = $1
               and status = 'ready' and created_at >= current_date)::text as ready_count,
             (select count(*) from orders where restaurant_id = $1
               and status = 'served' and created_at >= current_date)::text as served_count,
             (select count(*) from orders where restaurant_id = $1
               and status = 'cancelled' and created_at >= current_date)::text as cancelled_count,
             (select count(distinct table_id) from orders where restaurant_id = $1
               and paid = false and status <> 'cancelled'
               and created_at >= current_date)::text as unpaid_table_count,
             coalesce((select sum(total) from orders where restaurant_id = $1
               and paid = false and status <> 'cancelled'
               and created_at >= current_date), 0)::text as unpaid_total,
             (select count(*) from call_staff_requests where restaurant_id = $1
               and acknowledged = false)::text as call_count,
             (select count(*) from menus where restaurant_id = $1)::text as menu_count,
             (select count(*) from menus where restaurant_id = $1
               and available = true)::text as available_menu_count,
             (select count(*) from menus where restaurant_id = $1
               and available = false)::text as unavailable_menu_count,
             (select count(*) from categories where restaurant_id = $1)::text as category_count,
             (select count(*) from tables where restaurant_id = $1)::text as table_count,
             (select count(*) from tables where restaurant_id = $1
               and is_open = true)::text as open_table_count,
             (select count(*) from promotions where restaurant_id = $1
               and active = true
               and (start_at is null or start_at <= now())
               and (end_at is null or end_at > now()))::text as active_promotion_count,
             (select count(*) from promotions where restaurant_id = $1
               and active = true and start_at > now())::text as scheduled_promotion_count`, [access.restaurantId]),
            app.db.query(`select o.id, t.table_number, o.status, o.total, o.paid, o.created_at
           from orders o
           left join tables t on t.id = o.table_id
           where o.restaurant_id = $1 and o.created_at >= current_date
           order by o.created_at desc
           limit 6`, [access.restaurantId]),
        ]);
        const row = summary.rows[0];
        return reply.send({
            ok: true,
            summary: {
                todayRevenue: Number(row.today_revenue),
                todayPaidCount: Number(row.today_paid_count),
                pendingCount: Number(row.pending_count),
                readyCount: Number(row.ready_count),
                servedCount: Number(row.served_count),
                cancelledCount: Number(row.cancelled_count),
                unpaidTableCount: Number(row.unpaid_table_count),
                unpaidTotal: Number(row.unpaid_total),
                callCount: Number(row.call_count),
                menuCount: Number(row.menu_count),
                availableMenuCount: Number(row.available_menu_count),
                unavailableMenuCount: Number(row.unavailable_menu_count),
                categoryCount: Number(row.category_count),
                tableCount: Number(row.table_count),
                openTableCount: Number(row.open_table_count),
                closedTableCount: Number(row.table_count) - Number(row.open_table_count),
                activePromotionCount: Number(row.active_promotion_count),
                scheduledPromotionCount: Number(row.scheduled_promotion_count),
                recentOrders: recent.rows.map((order) => ({
                    id: order.id,
                    tableNumber: order.table_number,
                    status: order.status,
                    total: Number(order.total),
                    paid: order.paid,
                    createdAt: order.created_at,
                })),
            },
        });
    };
    registerCategoryRoutes(app, env);
    registerMenuRoutes(app, env);
    registerPromotionRoutes(app, env);
    registerTeamRoutes(app, env);
    registerZoneRoutes(app, env);
    registerTableRoutes(app, env);
    return { get_api_restaurants_restaurantId, patch_api_restaurants_restaurantId, get_api_restaurants_restaurantId_dashboard_summary };
}
function registerTeamRoutes(app, env) {
    app.get("/api/restaurants/:restaurantId/members", async (request, reply) => {
        const access = await accessAny(app, request, reply, env);
        if (!access)
            return;
        const result = await app.db.query(`select m.id, m.user_id, m.role, m.invited_email, m.phone,
                m.created_at, u.email
         from restaurant_members m
         join app_users u on u.id = m.user_id
         where m.restaurant_id = $1
         order by m.created_at`, [access.restaurantId]);
        return reply.send({ ok: true, members: result.rows });
    });
    app.delete("/api/restaurants/:restaurantId/members/:memberId", async (request, reply) => {
        const access = await accessOwner(app, request, reply, env);
        if (!access || !isUuid(request.params.memberId)) {
            return access ? invalidId(reply) : undefined;
        }
        const result = await app.db.query(`delete from restaurant_members
       where id = $1 and restaurant_id = $2
         and role <> 'owner' and user_id <> $3
       returning id`, [request.params.memberId, access.restaurantId, access.user.id]);
        if (!result.rows[0]) {
            return reply.status(409).send({ ok: false, error: "MEMBER_NOT_REMOVABLE" });
        }
        return reply.send({ ok: true });
    });
    app.get("/api/restaurants/:restaurantId/invites", async (request, reply) => {
        const access = await accessOwner(app, request, reply, env);
        if (!access)
            return;
        const result = await app.db.query(`select id, token, role, created_at, used_at, used_by, revoked_at
         from restaurant_invites where restaurant_id = $1
         order by created_at desc`, [access.restaurantId]);
        return reply.send({ ok: true, invites: result.rows });
    });
    app.post("/api/restaurants/:restaurantId/invites", async (request, reply) => {
        const access = await accessOwner(app, request, reply, env);
        if (!access)
            return;
        const role = request.body?.role;
        if (role !== "cook" && role !== "waiter")
            return invalidBody(reply);
        const result = await app.db.query(`insert into restaurant_invites
        (restaurant_id, token, role, created_by)
       values ($1, $2, $3, $4)
       returning id, token, role, created_at, used_at, used_by, revoked_at`, [
            access.restaurantId,
            randomBytes(24).toString("base64url"),
            role,
            access.user.id,
        ]);
        return reply.status(201).send({ ok: true, invite: result.rows[0] });
    });
    app.patch("/api/restaurants/:restaurantId/invites/:inviteId/revoke", async (request, reply) => {
        const access = await accessOwner(app, request, reply, env);
        if (!access || !isUuid(request.params.inviteId)) {
            return access ? invalidId(reply) : undefined;
        }
        const result = await app.db.query(`update restaurant_invites set revoked_at = coalesce(revoked_at, now())
       where id = $1 and restaurant_id = $2 and used_at is null
       returning id, token, role, created_at, used_at, used_by, revoked_at`, [request.params.inviteId, access.restaurantId]);
        if (!result.rows[0])
            return notFound(reply);
        return reply.send({ ok: true, invite: result.rows[0] });
    });
}
function registerPromotionRoutes(app, env) {
    app.get("/api/restaurants/:restaurantId/promotions", async (request, reply) => {
        const access = await accessAny(app, request, reply, env);
        if (!access)
            return;
        const result = await app.db.query(`select * from promotions where restaurant_id = $1
         order by sort_order, created_at desc`, [access.restaurantId]);
        return reply.send({ ok: true, promotions: result.rows });
    });
    app.post("/api/restaurants/:restaurantId/promotions", async (request, reply) => {
        const access = await accessOwner(app, request, reply, env);
        if (!access)
            return;
        const body = request.body ?? {};
        const title = body.title?.trim() ?? "";
        const startAt = parseOptionalDate(body.start_at);
        const endAt = parseOptionalDate(body.end_at);
        if (!title ||
            title.length > 200 ||
            !Number.isSafeInteger(body.sort_order ?? 0) ||
            startAt === undefined ||
            endAt === undefined ||
            (startAt && endAt && endAt <= startAt)) {
            return invalidBody(reply);
        }
        const result = await app.db.query(`insert into promotions
        (restaurant_id, title, description, image_url, active, sort_order,
         start_at, end_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8)
       returning *`, [
            access.restaurantId,
            title,
            cleanOptionalText(body.description),
            cleanOptionalText(body.image_url),
            body.active ?? true,
            body.sort_order ?? 0,
            startAt,
            endAt,
        ]);
        return reply.status(201).send({ ok: true, promotion: result.rows[0] });
    });
    app.patch("/api/restaurants/:restaurantId/promotions/:resourceId", async (request, reply) => {
        const access = await accessOwner(app, request, reply, env);
        if (!access || !isUuid(request.params.resourceId)) {
            return access ? invalidId(reply) : undefined;
        }
        const body = request.body ?? {};
        if ((body.title !== undefined && !body.title.trim()) ||
            (body.sort_order !== undefined && !Number.isSafeInteger(body.sort_order)) ||
            ("start_at" in body && parseOptionalDate(body.start_at) === undefined) ||
            ("end_at" in body && parseOptionalDate(body.end_at) === undefined)) {
            return invalidBody(reply);
        }
        const result = await app.db.query(`update promotions set
         title = coalesce($3, title),
         description = case when $4::boolean then $5 else description end,
         image_url = case when $6::boolean then $7 else image_url end,
         active = coalesce($8, active),
         sort_order = coalesce($9, sort_order),
         start_at = case when $10::boolean then $11 else start_at end,
         end_at = case when $12::boolean then $13 else end_at end
       where id = $1 and restaurant_id = $2
       returning *`, [
            request.params.resourceId,
            access.restaurantId,
            body.title?.trim() ?? null,
            "description" in body,
            cleanOptionalText(body.description),
            "image_url" in body,
            cleanOptionalText(body.image_url),
            body.active ?? null,
            body.sort_order ?? null,
            "start_at" in body,
            parseOptionalDate(body.start_at),
            "end_at" in body,
            parseOptionalDate(body.end_at),
        ]);
        if (!result.rows[0])
            return notFound(reply);
        return reply.send({ ok: true, promotion: result.rows[0] });
    });
    app.delete("/api/restaurants/:restaurantId/promotions/:resourceId", async (request, reply) => {
        const access = await accessOwner(app, request, reply, env);
        if (!access || !isUuid(request.params.resourceId)) {
            return access ? invalidId(reply) : undefined;
        }
        const result = await app.db.query("delete from promotions where id = $1 and restaurant_id = $2 returning id", [request.params.resourceId, access.restaurantId]);
        if (!result.rows[0])
            return notFound(reply);
        return reply.send({ ok: true });
    });
}
function registerCategoryRoutes(app, env) {
    app.get("/api/restaurants/:restaurantId/categories", async (request, reply) => {
        const access = await accessAny(app, request, reply, env);
        if (!access)
            return;
        const result = await app.db.query(`select id, restaurant_id, name, name_lo, name_en, sort_order, created_at
         from categories where restaurant_id = $1
         order by sort_order, name`, [access.restaurantId]);
        return reply.send({ ok: true, categories: result.rows });
    });
    app.post("/api/restaurants/:restaurantId/categories", async (request, reply) => {
        const access = await accessOwner(app, request, reply, env);
        if (!access)
            return;
        const name = request.body?.name?.trim() ?? "";
        const sortOrder = request.body?.sort_order ?? 0;
        if (!name || name.length > 200 || !Number.isSafeInteger(sortOrder)) {
            return invalidBody(reply);
        }
        const result = await app.db.query(`insert into categories
        (restaurant_id, name, name_lo, name_en, sort_order)
       values ($1, $2, $3, $4, $5)
       returning *`, [
            access.restaurantId,
            name,
            cleanOptionalText(request.body?.name_lo),
            cleanOptionalText(request.body?.name_en),
            sortOrder,
        ]);
        return reply.status(201).send({ ok: true, category: result.rows[0] });
    });
    app.patch("/api/restaurants/:restaurantId/categories/:resourceId", async (request, reply) => {
        const access = await accessOwner(app, request, reply, env);
        if (!access || !isUuid(request.params.resourceId))
            return access ? invalidId(reply) : undefined;
        const body = request.body ?? {};
        if ((body.name !== undefined && !body.name.trim()) ||
            (body.sort_order !== undefined && !Number.isSafeInteger(body.sort_order))) {
            return invalidBody(reply);
        }
        const result = await app.db.query(`update categories set
         name = coalesce($3, name),
         name_lo = case when $4::boolean then $5 else name_lo end,
         name_en = case when $6::boolean then $7 else name_en end,
         sort_order = coalesce($8, sort_order)
       where id = $1 and restaurant_id = $2
       returning *`, [
            request.params.resourceId,
            access.restaurantId,
            body.name?.trim() ?? null,
            "name_lo" in body,
            cleanOptionalText(body.name_lo),
            "name_en" in body,
            cleanOptionalText(body.name_en),
            body.sort_order ?? null,
        ]);
        if (!result.rows[0])
            return notFound(reply);
        return reply.send({ ok: true, category: result.rows[0] });
    });
    app.delete("/api/restaurants/:restaurantId/categories/:resourceId", async (request, reply) => {
        const access = await accessOwner(app, request, reply, env);
        if (!access || !isUuid(request.params.resourceId))
            return access ? invalidId(reply) : undefined;
        const client = await app.db.connect();
        try {
            await client.query("begin");
            if (request.query.deleteMenus === "true") {
                await client.query("delete from menus where category_id = $1 and restaurant_id = $2", [request.params.resourceId, access.restaurantId]);
            }
            const result = await client.query("delete from categories where id = $1 and restaurant_id = $2 returning id", [request.params.resourceId, access.restaurantId]);
            if (!result.rows[0]) {
                await client.query("rollback");
                return notFound(reply);
            }
            await client.query("commit");
            return reply.send({ ok: true });
        }
        catch (error) {
            await client.query("rollback");
            throw error;
        }
        finally {
            client.release();
        }
    });
}
function registerMenuRoutes(app, env) {
    registerMenuStockAdjustment(app, env, { accessOwner, isUuid, invalidId, invalidBody });
    registerMenuStockTransfer(app, env, { accessOwner, isUuid, invalidId, invalidBody });
    registerMenuStockHistory(app, env, { accessOwner, invalidBody });
    registerMenuStockOutgoing(app, env, { accessOwner, invalidBody });
    app.get("/api/restaurants/:restaurantId/menus", async (request, reply) => {
        const access = await accessAny(app, request, reply, env);
        if (!access)
            return;
        const result = await app.db.query(`select id, restaurant_id, category_id, name, name_lo, name_en,
                price, unit, cost_price, description, track_stock, stock_quantity, stock_barcode, low_alert_limit,
                image_url, available, bundles, created_at
         from menus where restaurant_id = $1 order by created_at desc`, [access.restaurantId]);
        return reply.send({ ok: true, menus: result.rows });
    });
    app.post("/api/restaurants/:restaurantId/menus", async (request, reply) => {
        const access = await accessOwner(app, request, reply, env);
        if (!access)
            return;
        const body = request.body ?? {};
        const name = body.name?.trim() ?? "";
        if (!name ||
            name.length > 200 ||
            !Number.isFinite(body.price) ||
            body.price < 0 ||
            (body.category_id != null && !isUuid(body.category_id)) ||
            (body.bundles !== undefined && !Array.isArray(body.bundles)) ||
            (body.unit !== undefined && (typeof body.unit !== "string" || !body.unit.trim() || body.unit.trim().length > 40)) ||
            (body.cost_price !== undefined && (!Number.isFinite(body.cost_price) || body.cost_price < 0)) ||
            (body.low_alert_limit !== undefined && (!Number.isFinite(body.low_alert_limit) || body.low_alert_limit < 0)) ||
            (body.stock_quantity !== undefined && (!Number.isFinite(body.stock_quantity) || body.stock_quantity < 0))) {
            return invalidBody(reply);
        }
        if (body.category_id &&
            !(await categoryBelongsToRestaurant(app, body.category_id, access.restaurantId))) {
            return reply.status(400).send({ ok: false, error: "INVALID_CATEGORY" });
        }
        const result = await app.db.query(`insert into menus
        (restaurant_id, category_id, name, name_lo, name_en, price, cost_price,
         description, track_stock, stock_quantity, stock_barcode, low_alert_limit, image_url, available, bundles, unit)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16)
       returning *`, [
            access.restaurantId,
            body.category_id ?? null,
            name,
            cleanOptionalText(body.name_lo),
            cleanOptionalText(body.name_en),
            body.price,
            body.cost_price ?? 0,
            cleanOptionalText(body.description),
            body.track_stock ?? false,
            body.stock_quantity ?? 0,
            cleanOptionalText(body.stock_barcode),
            body.low_alert_limit ?? 0,
            cleanOptionalText(body.image_url),
            body.available ?? true,
            JSON.stringify(body.bundles ?? []),
            body.unit?.trim() ?? null,
        ]);
        return reply.status(201).send({ ok: true, menu: result.rows[0] });
    });
    app.patch("/api/restaurants/:restaurantId/menus/:resourceId", async (request, reply) => {
        const access = await accessOwner(app, request, reply, env);
        if (!access || !isUuid(request.params.resourceId))
            return access ? invalidId(reply) : undefined;
        const body = request.body ?? {};
        if ((body.name !== undefined && !body.name.trim()) ||
            (body.price !== undefined && (!Number.isFinite(body.price) || body.price < 0)) ||
            (body.category_id != null && !isUuid(body.category_id)) ||
            (body.bundles !== undefined && !Array.isArray(body.bundles)) ||
            (body.unit !== undefined && (typeof body.unit !== "string" || !body.unit.trim() || body.unit.trim().length > 40)) ||
            (body.cost_price !== undefined && (!Number.isFinite(body.cost_price) || body.cost_price < 0)) ||
            (body.low_alert_limit !== undefined && (!Number.isFinite(body.low_alert_limit) || body.low_alert_limit < 0)) ||
            (body.stock_quantity !== undefined && (!Number.isFinite(body.stock_quantity) || body.stock_quantity < 0))) {
            return invalidBody(reply);
        }
        if (body.category_id &&
            !(await categoryBelongsToRestaurant(app, body.category_id, access.restaurantId))) {
            return reply.status(400).send({ ok: false, error: "INVALID_CATEGORY" });
        }
        const result = await app.db.query(`update menus set
         category_id = case when $3::boolean then $4 else category_id end,
         name = coalesce($5, name),
         name_lo = case when $6::boolean then $7 else name_lo end,
         name_en = case when $8::boolean then $9 else name_en end,
         price = coalesce($10, price),
         image_url = case when $11::boolean then $12 else image_url end,
         available = coalesce($13, available),
         bundles = case when $14::boolean then $15::jsonb else bundles end,
         cost_price = coalesce($16, cost_price),
         description = case when $17::boolean then $18 else description end,
         track_stock = coalesce($19, track_stock),
         low_alert_limit = coalesce($20, low_alert_limit)
         ,stock_quantity = coalesce($21, stock_quantity)
         ,stock_barcode = case when $22::boolean then $23 else stock_barcode end
         ,unit = coalesce($24, unit)
       where id = $1 and restaurant_id = $2
       returning *`, [
            request.params.resourceId,
            access.restaurantId,
            "category_id" in body,
            body.category_id ?? null,
            body.name?.trim() ?? null,
            "name_lo" in body,
            cleanOptionalText(body.name_lo),
            "name_en" in body,
            cleanOptionalText(body.name_en),
            body.price ?? null,
            "image_url" in body,
            cleanOptionalText(body.image_url),
            body.available ?? null,
            "bundles" in body,
            JSON.stringify(body.bundles ?? []),
            body.cost_price ?? null,
            "description" in body,
            cleanOptionalText(body.description),
            body.track_stock ?? null,
            body.low_alert_limit ?? null,
            body.stock_quantity ?? null,
            "stock_barcode" in body,
            cleanOptionalText(body.stock_barcode),
            body.unit?.trim() ?? null,
        ]);
        if (!result.rows[0])
            return notFound(reply);
        return reply.send({ ok: true, menu: result.rows[0] });
    });
    app.delete("/api/restaurants/:restaurantId/menus/:resourceId", async (request, reply) => {
        const access = await accessOwner(app, request, reply, env);
        if (!access || !isUuid(request.params.resourceId))
            return access ? invalidId(reply) : undefined;
        const result = await app.db.query("delete from menus where id = $1 and restaurant_id = $2 returning id", [request.params.resourceId, access.restaurantId]);
        if (!result.rows[0])
            return notFound(reply);
        return reply.send({ ok: true });
    });
    app.delete("/api/restaurants/:restaurantId/menus", async (request, reply) => {
        const access = await accessOwner(app, request, reply, env);
        if (!access)
            return;
        const result = await app.db.query("delete from menus where restaurant_id = $1", [access.restaurantId]);
        return reply.send({ ok: true, deleted: result.rowCount ?? 0 });
    });
}
function registerZoneRoutes(app, env) {
    app.get("/api/restaurants/:restaurantId/zones", async (request, reply) => {
        const access = await accessAny(app, request, reply, env);
        if (!access)
            return;
        const result = await app.db.query("select * from table_zones where restaurant_id = $1 order by sort_order, name", [access.restaurantId]);
        return reply.send({ ok: true, zones: result.rows });
    });
    app.post("/api/restaurants/:restaurantId/zones", async (request, reply) => {
        const access = await accessOwner(app, request, reply, env);
        if (!access)
            return;
        const name = request.body?.name?.trim() ?? "";
        const sortOrder = request.body?.sort_order ?? 0;
        if (!name || name.length > 200 || !Number.isSafeInteger(sortOrder)) {
            return invalidBody(reply);
        }
        const result = await app.db.query(`insert into table_zones (restaurant_id, name, sort_order)
         values ($1,$2,$3) returning *`, [access.restaurantId, name, sortOrder]);
        return reply.status(201).send({ ok: true, zone: result.rows[0] });
    });
    app.delete("/api/restaurants/:restaurantId/zones/:resourceId", async (request, reply) => {
        const access = await accessOwner(app, request, reply, env);
        if (!access || !isUuid(request.params.resourceId)) {
            return access ? invalidId(reply) : undefined;
        }
        try {
            const result = await app.db.query("delete from table_zones where id = $1 and restaurant_id = $2 returning id", [request.params.resourceId, access.restaurantId]);
            if (!result.rows[0])
                return notFound(reply);
            return reply.send({ ok: true });
        }
        catch (error) {
            if (isForeignKeyViolation(error)) {
                return reply
                    .status(409)
                    .send({ ok: false, error: "ZONE_HAS_TABLES" });
            }
            throw error;
        }
    });
}
function registerTableRoutes(app, env) {
    app.get("/api/restaurants/:restaurantId/tables", async (request, reply) => {
        const access = await accessAny(app, request, reply, env);
        if (!access)
            return;
        const result = await app.db.query(`select t.id, t.restaurant_id, t.zone_id, t.table_number, t.qr_url,
       t.short_code, t.is_open, t.created_at,
       t.bill_check_requested_at, t.bill_check_requested_by,
       activity.last_order_at, activity.last_unpaid_order_at
from tables t
left join lateral (
  select max(o.created_at) filter (where o.status::text <> 'cancelled') as last_order_at,
         max(o.created_at) filter (where o.paid = false and o.status::text <> 'cancelled') as last_unpaid_order_at
  from orders o
  where o.restaurant_id = t.restaurant_id and o.table_id = t.id
) activity on true
where t.restaurant_id = $1
order by t.table_number`, [access.restaurantId]);
        return reply.send({ ok: true, tables: result.rows });
    });
    app.post("/api/restaurants/:restaurantId/tables", async (request, reply) => {
        const access = await accessOwner(app, request, reply, env);
        if (!access)
            return;
        const zoneId = request.body?.zone_id ?? "";
        const tableNumber = normalizeTableLabel(request.body?.table_number);
        if (!isUuid(zoneId) || !tableNumber) {
            return invalidBody(reply);
        }
        const result = await app.db.query(`insert into tables (restaurant_id, zone_id, table_number, qr_url)
       select $1, z.id, $3, $4
       from table_zones z
       where z.id = $2 and z.restaurant_id = $1
       on conflict (restaurant_id, zone_id, table_number) do nothing
       returning tables.*`, [
            access.restaurantId,
            zoneId,
            tableNumber,
            cleanOptionalText(request.body?.qr_url),
        ]);
        if (!result.rows[0]) {
            if (await zoneBelongsToRestaurant(app, zoneId, access.restaurantId)) {
                return reply.status(409).send({ ok: false, error: "TABLE_ALREADY_EXISTS" });
            }
            return reply.status(400).send({ ok: false, error: "INVALID_ZONE" });
        }
        return reply.status(201).send({ ok: true, table: result.rows[0] });
    });
    app.post("/api/restaurants/:restaurantId/tables/bulk", async (request, reply) => {
        const access = await accessOwner(app, request, reply, env);
        if (!access)
            return;
        const rows = request.body?.tables;
        if (!Array.isArray(rows) ||
            rows.length === 0 ||
            rows.length > 500 ||
            rows.some((row) => !isUuid(row.zone_id ?? "") ||
                !normalizeTableLabel(row.table_number))) {
            return invalidBody(reply);
        }
        const result = await app.db.query(`insert into tables (restaurant_id, zone_id, table_number)
       select $1, incoming.zone_id, incoming.table_number
       from jsonb_to_recordset($2::jsonb)
         as incoming(zone_id uuid, table_number text)
       join table_zones z
         on z.id = incoming.zone_id and z.restaurant_id = $1
       on conflict (restaurant_id, zone_id, table_number) do nothing
       returning tables.*`, [access.restaurantId, JSON.stringify(rows.map(row => ({ ...row, table_number: normalizeTableLabel(row.table_number) })))]);
        return reply.status(201).send({ ok: true, tables: result.rows });
    });
    app.patch("/api/restaurants/:restaurantId/tables/:resourceId", async (request, reply) => {
        if (!isUuid(request.params.restaurantId) || !isUuid(request.params.resourceId)) {
            return invalidId(reply);
        }
        const access = await requireRestaurantAccess(request, reply, env, request.params.restaurantId, ["owner", "waiter", "staff"]);
        if (!access)
            return;
        const body = request.body ?? {};
        if (access.role !== "owner" &&
            Object.keys(body).some((key) => key !== "is_open")) {
            return reply.status(403).send({ ok: false, error: "FORBIDDEN" });
        }
        if ((body.zone_id !== undefined && !isUuid(body.zone_id)) ||
            (body.table_number !== undefined &&
                !normalizeTableLabel(body.table_number))) {
            return invalidBody(reply);
        }
        if (body.zone_id &&
            !(await zoneBelongsToRestaurant(app, body.zone_id, access.restaurantId))) {
            return reply.status(400).send({ ok: false, error: "INVALID_ZONE" });
        }
        const result = await app.db.query(`update tables set
         zone_id = coalesce($3, zone_id),
         table_number = coalesce($4, table_number),
         qr_url = case when $5::boolean then $6 else qr_url end,
         is_open = coalesce($7, is_open)
       where id = $1 and restaurant_id = $2
       returning *`, [
            request.params.resourceId,
            access.restaurantId,
            body.zone_id ?? null,
            body.table_number === undefined ? null : normalizeTableLabel(body.table_number),
            "qr_url" in body,
            cleanOptionalText(body.qr_url),
            body.is_open ?? null,
        ]);
        if (!result.rows[0])
            return notFound(reply);
        return reply.send({ ok: true, table: result.rows[0] });
    });
    app.delete("/api/restaurants/:restaurantId/tables/:resourceId", async (request, reply) => {
        const access = await accessOwner(app, request, reply, env);
        if (!access || !isUuid(request.params.resourceId))
            return access ? invalidId(reply) : undefined;
        const result = await app.db.query("delete from tables where id = $1 and restaurant_id = $2 returning id", [request.params.resourceId, access.restaurantId]);
        if (!result.rows[0])
            return notFound(reply);
        return reply.send({ ok: true });
    });
}
async function accessAny(_app, request, reply, env) {
    if (!isUuid(request.params.restaurantId)) {
        invalidId(reply);
        return null;
    }
    return requireRestaurantAccess(request, reply, env, request.params.restaurantId);
}
async function accessOwner(app, request, reply, env) {
    const access = await accessAny(app, request, reply, env);
    if (!access)
        return null;
    if (access.role !== "owner") {
        void reply.status(403).send({ ok: false, error: "FORBIDDEN" });
        return null;
    }
    return access;
}
async function categoryBelongsToRestaurant(app, categoryId, restaurantId) {
    const result = await app.db.query("select 1 from categories where id = $1 and restaurant_id = $2", [categoryId, restaurantId]);
    return Boolean(result.rows[0]);
}
async function zoneBelongsToRestaurant(app, zoneId, restaurantId) {
    const result = await app.db.query("select 1 from table_zones where id = $1 and restaurant_id = $2", [zoneId, restaurantId]);
    return Boolean(result.rows[0]);
}
function validPercentage(value) {
    return value === undefined || (Number.isFinite(value) && value >= 0 && value <= 100);
}
function cleanOptionalText(value) {
    if (value == null)
        return null;
    return value.trim() || null;
}
function parseOptionalDate(value) {
    if (value == null || value === "")
        return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
}
function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
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
function isForeignKeyViolation(error) {
    return (typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "23503");
}
