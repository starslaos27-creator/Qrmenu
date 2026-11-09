import { requireRestaurantAccess } from "../security/authorization.js";

const staffPresence = new Map();

export function createChatController(app, env) {
  const get_api_public_staff_online_tableCode = async (request, reply) => {
        if (!app.db)
            return databaseUnavailable(reply);
        const table = await findOpenTable(app.db, request.params.tableCode);
        if (!table)
            return reply.status(404).send({ ok: false, error: "TABLE_NOT_FOUND" });
        const lastSeen = staffPresence.get(table.restaurant_id) ?? 0;
        return reply.send({ ok: true, online: Date.now() - lastSeen < 30000 });
    };
  const get_api_public_chat_tableCode = async (request, reply) => {
        if (!app.db)
            return databaseUnavailable(reply);
        const table = await findOpenTable(app.db, request.params.tableCode);
        if (!table)
            return reply.status(404).send({ ok: false, error: "TABLE_NOT_FOUND" });
        const markRead = request.query?.read === "true";
        if (markRead) {
            await app.db.query(`update table_chat_messages
               set read_by_customer = true
               where table_id = $1 and sender = 'staff' and read_by_customer = false`, [table.id]);
        }
        const result = await app.db.query(`select m.id, m.sender, m.message, m.created_at, m.read_by_staff,
              coalesce(u.display_name, u.email, 'พนักงาน') as sender_name
           from table_chat_messages m
           left join app_users u on u.id = m.sender_user_id
           where m.table_id = $1
             and m.created_at > now() - interval '7 days'
           order by m.created_at asc limit 300`, [table.id]);
        const unread = await app.db.query(`select count(*)::int as count
           from table_chat_messages
           where table_id = $1 and sender = 'staff' and read_by_customer = false`, [table.id]);
        return reply.send({ ok: true, table, messages: result.rows, unread: unread.rows[0].count });
    };
  const post_api_public_chat_tableCode = async (request, reply) => {
        if (!app.db)
            return databaseUnavailable(reply);
        const table = await findOpenTable(app.db, request.params.tableCode);
        if (!table)
            return reply.status(409).send({ ok: false, error: "TABLE_NOT_OPEN" });
        const message = cleanMessage(request.body?.message);
        if (!message)
            return reply.status(400).send({ ok: false, error: "INVALID_MESSAGE" });
        const recent = await app.db.query(`select count(*)::int as count
           from table_chat_messages
           where table_id = $1 and sender = 'customer'
             and created_at > now() - interval '10 seconds'`, [table.id]);
        if (recent.rows[0].count >= 5)
            return reply.status(429).send({ ok: false, error: "PLEASE_WAIT" });
        const result = await app.db.query(`insert into table_chat_messages
             (restaurant_id, table_id, sender, message, read_by_customer)
           values ($1, $2, 'customer', $3, true)
           returning id, sender, message, created_at`, [table.restaurant_id, table.id, message]);
        return reply.status(201).send({ ok: true, message: result.rows[0] });
    };
  const get_api_restaurants_restaurantId_chat = async (request, reply) => {
        const access = await requireRestaurantAccess(request, reply, env, request.params.restaurantId,
            ["owner", "waiter", "staff", "cook"]);
        if (!access)
            return;
        staffPresence.set(access.restaurantId, Date.now());
        const result = await app.db.query(`with latest as (
             select distinct on (m.table_id) m.table_id, m.message, m.sender, m.created_at
             from table_chat_messages m
             where m.restaurant_id = $1
             order by m.table_id, m.created_at desc
           ), unread as (
             select table_id, count(*)::int as count
             from table_chat_messages
             where restaurant_id = $1 and sender = 'customer' and read_by_staff = false
             group by table_id
           )
           select t.id as table_id, t.table_number, z.name as zone_name,
             l.message as last_message, l.sender as last_sender, l.created_at,
             coalesce(u.count, 0) as unread
           from latest l
           join tables t on t.id = l.table_id
           left join table_zones z on z.id = t.zone_id
           left join unread u on u.table_id = t.id
           order by (coalesce(u.count, 0) > 0) desc, l.created_at desc`, [access.restaurantId]);
        return reply.send({ ok: true, conversations: result.rows });
    };
  const get_api_restaurants_restaurantId_chat_tableId = async (request, reply) => {
        const access = await requireRestaurantAccess(request, reply, env, request.params.restaurantId,
            ["owner", "waiter", "staff", "cook"]);
        if (!access)
            return;
        if (!isUuid(request.params.tableId))
            return reply.status(400).send({ ok: false, error: "INVALID_ID" });
        const table = await findRestaurantTable(app.db, access.restaurantId, request.params.tableId);
        if (!table)
            return reply.status(404).send({ ok: false, error: "TABLE_NOT_FOUND" });
        staffPresence.set(access.restaurantId, Date.now());
        if (request.query?.read === "true") {
            await app.db.query(`update table_chat_messages set read_by_staff = true
               where restaurant_id = $1 and table_id = $2
                 and sender = 'customer' and read_by_staff = false`, [access.restaurantId, table.id]);
        }
        const result = await app.db.query(`select m.id, m.sender, m.message, m.created_at,
              coalesce(u.display_name, u.email, 'พนักงาน') as sender_name
           from table_chat_messages m
           left join app_users u on u.id = m.sender_user_id
           where m.restaurant_id = $1 and m.table_id = $2
             and m.created_at > now() - interval '30 days'
           order by m.created_at asc limit 500`, [access.restaurantId, table.id]);
        return reply.send({ ok: true, table, messages: result.rows });
    };
  const post_api_restaurants_restaurantId_chat_tableId = async (request, reply) => {
        const access = await requireRestaurantAccess(request, reply, env, request.params.restaurantId,
            ["owner", "waiter", "staff", "cook"]);
        if (!access)
            return;
        if (!isUuid(request.params.tableId))
            return reply.status(400).send({ ok: false, error: "INVALID_ID" });
        const table = await findRestaurantTable(app.db, access.restaurantId, request.params.tableId);
        if (!table)
            return reply.status(404).send({ ok: false, error: "TABLE_NOT_FOUND" });
        staffPresence.set(access.restaurantId, Date.now());
        const message = cleanMessage(request.body?.message);
        if (!message)
            return reply.status(400).send({ ok: false, error: "INVALID_MESSAGE" });
        const result = await app.db.query(`insert into table_chat_messages
             (restaurant_id, table_id, sender, sender_user_id, message, read_by_staff)
           values ($1, $2, 'staff', $3, $4, true)
           returning id, sender, message, created_at`, [access.restaurantId, table.id, access.user.id, message]);
        return reply.status(201).send({ ok: true, message: result.rows[0] });
    };
  return { get_api_public_staff_online_tableCode, get_api_public_chat_tableCode, post_api_public_chat_tableCode, get_api_restaurants_restaurantId_chat, get_api_restaurants_restaurantId_chat_tableId, post_api_restaurants_restaurantId_chat_tableId };
}

function cleanMessage(value) {
    if (typeof value !== "string")
        return null;
    const message = value.replace(/\r\n?/g, "\n").trim();
    return message.length >= 1 && message.length <= 1000 ? message : null;
}
function normalizeTableCode(value) {
    const code = String(value ?? "").trim().toUpperCase();
    return /^[A-Z0-9_-]{4,64}$/.test(code) ? code : null;
}
async function findOpenTable(db, codeValue) {
    const code = normalizeTableCode(codeValue);
    if (!code)
        return null;
    const result = await db.query(`select t.id, t.restaurant_id, t.table_number, t.short_code,
            z.name as zone_name
         from tables t left join table_zones z on z.id = t.zone_id
         join restaurants r on r.id = t.restaurant_id
         where t.short_code = $1 and t.is_open = true and r.suspended_at is null`, [code]);
    return result.rows[0] ?? null;
}
async function findRestaurantTable(db, restaurantId, tableId) {
    const result = await db.query(`select t.id, t.restaurant_id, t.table_number, t.short_code,
            z.name as zone_name
         from tables t left join table_zones z on z.id = t.zone_id
         where t.id = $1 and t.restaurant_id = $2`, [tableId, restaurantId]);
    return result.rows[0] ?? null;
}
function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
function databaseUnavailable(reply) {
    return reply.status(503).send({ ok: false, error: "DATABASE_NOT_CONFIGURED" });
}
