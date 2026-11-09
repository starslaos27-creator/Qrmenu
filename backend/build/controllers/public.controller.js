import { isWithinWeeklyHours } from "../security/weekly-hours.js";
export function createPublicController(app, env) {
    const get_api_public_menu_tableCode = async (request, reply) => {
        if (!app.db)
            return databaseUnavailable(reply);
        const tableCode = normalizeTableCode(request.params.tableCode);
        if (!tableCode) {
            return reply.status(400).send({ ok: false, error: "INVALID_TABLE_CODE" });
        }
        const table = await findTableByCode(app.db, tableCode);
        if (!table) {
            return reply.status(404).send({ ok: false, error: "TABLE_NOT_FOUND" });
        }
        return reply.send({
            ok: true,
            ...(await loadPublicMenuData(app.db, table)),
        });
    };
    const get_api_public_menu_table_tableId = async (request, reply) => {
        if (!app.db)
            return databaseUnavailable(reply);
        if (!isUuid(request.params.tableId)) {
            return reply.status(400).send({ ok: false, error: "INVALID_TABLE_ID" });
        }
        const result = await app.db.query(`select id, restaurant_id, zone_id, table_number, short_code, is_open
         from tables
         where id = $1 and exists (
           select 1 from restaurants r
           where r.id = tables.restaurant_id and r.suspended_at is null
         )`, [request.params.tableId]);
        const table = result.rows[0];
        if (!table) {
            return reply.status(404).send({ ok: false, error: "TABLE_NOT_FOUND" });
        }
        return reply.send({
            ok: true,
            ...(await loadPublicMenuData(app.db, table)),
        });
    };
    const get_api_public_tables_tableCode_orders = async (request, reply) => {
        if (!app.db)
            return databaseUnavailable(reply);
        const tableCode = normalizeTableCode(request.params.tableCode);
        if (!tableCode) {
            return reply.status(400).send({ ok: false, error: "INVALID_TABLE_CODE" });
        }
        const table = await findTableByCode(app.db, tableCode);
        if (!table) {
            return reply.status(404).send({ ok: false, error: "TABLE_NOT_FOUND" });
        }
        const orders = await app.db.query(`select id, table_id, restaurant_id, items, status, total, paid,
                paid_at, payment_method, cancel_reason, accepted_at,
                accepted_by, completed_at, completed_by, created_at
         from orders
         where restaurant_id = $1 and table_id = $2
           and (paid = false or paid_at > now() - interval '15 seconds')
         order by created_at`, [table.restaurant_id, table.id]);
        const billCheck = table.is_open ? await app.db.query(`select exists(
          select 1 from call_staff_requests request
          where request.restaurant_id = $1 and request.table_id = $2
            and request.reason = 'ขอเช็กบิล'
            and request.created_at > coalesce((select max(paid_at) from orders where table_id = $2 and paid), '-infinity'::timestamptz)
        ) as requested`, [table.restaurant_id, table.id]) : { rows: [{ requested: false }] };
        return reply.send({ ok: true, orders: orders.rows, billCheckRequested: Boolean(billCheck.rows[0]?.requested) });
    };
    const post_api_public_orders = async (request, reply) => {
        if (!app.db)
            return databaseUnavailable(reply);
        const tableCode = normalizeTableCode(request.body?.tableCode ?? "");
        const items = validateOrderItems(request.body?.items);
        const clientRequestId = request.body?.clientRequestId?.trim() || null;
        if (!tableCode) {
            return reply.status(400).send({ ok: false, error: "INVALID_TABLE_CODE" });
        }
        if (!items) {
            return reply.status(400).send({ ok: false, error: "INVALID_ITEMS" });
        }
        if (clientRequestId && clientRequestId.length > 100) {
            return reply
                .status(400)
                .send({ ok: false, error: "INVALID_CLIENT_REQUEST_ID" });
        }
        const client = await app.db.connect();
        try {
            await client.query("begin");
            const tableResult = await client.query(`select t.id, t.restaurant_id, t.zone_id, t.table_number,
                  t.short_code, t.is_open, r.accepting_orders, r.suspended_at, r.weekly_hours
           from tables t
           join restaurants r on r.id = t.restaurant_id
           where t.short_code = $1
           for update of t`, [tableCode]);
            const table = tableResult.rows[0];
            if (!table) {
                await client.query("rollback");
                return reply.status(404).send({ ok: false, error: "TABLE_NOT_FOUND" });
            }
            if (!table.is_open || !table.accepting_orders || table.suspended_at || !isWithinWeeklyHours(table.weekly_hours)) {
                await client.query("rollback");
                return reply.status(409).send({ ok: false, error: "ORDERING_CLOSED" });
            }
            if (clientRequestId) {
                const existing = await client.query(`select * from orders
             where restaurant_id = $1 and client_request_id = $2`, [table.restaurant_id, clientRequestId]);
                if (existing.rows[0]) {
                    await client.query("commit");
                    return reply.send({ ok: true, order: existing.rows[0], reused: true });
                }
            }
            const menuIds = [...new Set(items.map((item) => item.menu_id))];
            const menus = await client.query(`select id, name, name_lo, name_en, price, available
           from menus
           where restaurant_id = $1 and id = any($2::uuid[])`, [table.restaurant_id, menuIds]);
            const menuMap = new Map(menus.rows.map((menu) => [menu.id, menu]));
            let total = 0;
            const snapshotItems = items.map((item) => {
                const menu = menuMap.get(item.menu_id);
                if (!menu || !menu.available) {
                    throw new PublicRouteError(409, "MENU_UNAVAILABLE");
                }
                const unitPrice = Number(menu.price);
                total += unitPrice * item.qty;
                return {
                    menu_id: menu.id,
                    qty: item.qty,
                    ...(item.note ? { note: item.note } : {}),
                    name: menu.name,
                    name_lo: menu.name_lo,
                    name_en: menu.name_en,
                    unit_price: unitPrice,
                };
            });
            const order = await client.query(`insert into orders
            (restaurant_id, table_id, items, total, status, client_request_id)
           values ($1, $2, $3::jsonb, $4, 'pending', $5)
           returning *`, [
                table.restaurant_id,
                table.id,
                JSON.stringify(snapshotItems),
                total,
                clientRequestId,
            ]);
            await client.query("commit");
            return reply.status(201).send({ ok: true, order: order.rows[0] });
        }
        catch (error) {
            await client.query("rollback");
            if (error instanceof PublicRouteError) {
                return reply.status(error.status).send({ ok: false, error: error.code });
            }
            if (isUniqueViolation(error) && clientRequestId) {
                const existing = await app.db.query(`select * from orders
             where client_request_id = $1
             order by created_at desc limit 1`, [clientRequestId]);
                if (existing.rows[0]) {
                    return reply.send({ ok: true, order: existing.rows[0], reused: true });
                }
            }
            request.log.error({ err: error }, "public order failed");
            return reply.status(500).send({ ok: false, error: "ORDER_FAILED" });
        }
        finally {
            client.release();
        }
    };
    const post_api_public_call_staff = async (request, reply) => {
        if (!app.db)
            return databaseUnavailable(reply);
        const tableCode = normalizeTableCode(request.body?.tableCode ?? "");
        const reason = request.body?.reason?.trim() || null;
        if (!tableCode) {
            return reply.status(400).send({ ok: false, error: "INVALID_TABLE_CODE" });
        }
        if (reason && reason.length > 300) {
            return reply.status(400).send({ ok: false, error: "REASON_TOO_LONG" });
        }
        const table = await findTableByCode(app.db, tableCode);
        if (!table || !table.is_open) {
            return reply.status(409).send({ ok: false, error: "TABLE_NOT_OPEN" });
        }
        const recent = await app.db.query(`select 1 from call_staff_requests
         where table_id = $1 and created_at > now() - interval '30 seconds'
         limit 1`, [table.id]);
        if (recent.rows[0]) {
            return reply.status(429).send({ ok: false, error: "PLEASE_WAIT" });
        }
        const result = await app.db.query(`insert into call_staff_requests
          (restaurant_id, table_id, reason)
         values ($1, $2, $3)
         returning *`, [table.restaurant_id, table.id, reason]);
        return reply.status(201).send({ ok: true, request: result.rows[0] });
    };
    return { get_api_public_menu_tableCode, get_api_public_menu_table_tableId, get_api_public_tables_tableCode_orders, post_api_public_orders, post_api_public_call_staff };
}
async function loadPublicMenuData(client, table) {
    const [restaurant, zone, menus, categories, promotions] = await Promise.all([
        client.query(`select id, name, currency_code, accepting_orders, open_time, close_time, weekly_hours,
              service_charge_pct, vat_pct, payment_qr_url, kitchen_print_width
       from restaurants where id = $1`, [table.restaurant_id]),
        client.query(`select id, restaurant_id, name, sort_order, created_at
       from table_zones where id = $1`, [table.zone_id]),
        client.query(`select id, restaurant_id, category_id, name, name_lo, name_en,
              price, description, image_url, available, bundles, created_at
       from menus
       where restaurant_id = $1 and available = true
       order by created_at desc`, [table.restaurant_id]),
        client.query(`select id, restaurant_id, name, name_lo, name_en, sort_order, created_at
       from categories where restaurant_id = $1 order by sort_order, name`, [table.restaurant_id]),
        client.query(`select id, restaurant_id, title, description, image_url, active,
              sort_order, start_at, end_at, created_at
       from promotions
       where restaurant_id = $1
         and active = true
         and (start_at is null or start_at <= now())
         and (end_at is null or end_at > now())
       order by sort_order, created_at desc`, [table.restaurant_id]),
    ]);
    return {
        restaurant: { ...restaurant.rows[0], accepting_orders: restaurant.rows[0].accepting_orders && isWithinWeeklyHours(restaurant.rows[0].weekly_hours) },
        table,
        zone: zone.rows[0] ?? null,
        menus: menus.rows,
        categories: categories.rows,
        promotions: promotions.rows,
    };
}
async function findTableByCode(client, tableCode) {
    const result = await client.query(`select t.id, t.restaurant_id, t.zone_id, t.table_number,
            t.short_code, t.is_open
     from tables t
     join restaurants r on r.id = t.restaurant_id
     where t.short_code = $1 and r.suspended_at is null`, [tableCode]);
    return result.rows[0] ?? null;
}
function validateOrderItems(input) {
    if (!Array.isArray(input) || input.length === 0 || input.length > 50)
        return null;
    const combined = new Map();
    for (const raw of input) {
        const menuId = raw?.menu_id?.trim() ?? "";
        const qty = raw?.qty;
        const note = raw?.note?.trim() ?? "";
        if (!isUuid(menuId) || !Number.isSafeInteger(qty) || qty < 1 || qty > 99) {
            return null;
        }
        if (note.length > 300)
            return null;
        const existing = combined.get(menuId) ?? { qty: 0, notes: [] };
        existing.qty += qty;
        if (existing.qty > 99)
            return null;
        if (note)
            existing.notes.push(note);
        combined.set(menuId, existing);
    }
    return [...combined.entries()].map(([menu_id, value]) => ({
        menu_id,
        qty: value.qty,
        note: value.notes.join("; ") || null,
    }));
}
function normalizeTableCode(value) {
    const normalized = value.trim().toUpperCase();
    return /^[A-F0-9]{8}$/.test(normalized) ? normalized : null;
}
function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
function databaseUnavailable(reply) {
    return reply.status(503).send({ ok: false, error: "DATABASE_NOT_CONFIGURED" });
}
function isUniqueViolation(error) {
    return (typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "23505");
}
class PublicRouteError extends Error {
    status;
    code;
    constructor(status, code) {
        super(code);
        this.status = status;
        this.code = code;
    }
}
