// Keep receipt labels stable even after a product or operator is renamed/deleted.
export async function receiptSnapshot(client, menu, userId) {
    const user = (await client.query('select display_name, email from app_users where id = $1', [userId])).rows[0];
    return {menu_name:menu.name, barcode:menu.stock_barcode || null, unit:menu.unit || null,
        actor_name:user?.display_name || user?.email || null, snapshot_version:1};
}

export function createMenuStockHistoryController(app, env, { accessOwner, invalidBody }) {
  const get_api_restaurants_restaurantId_menu_receipts = async (request, reply) => {
        const access = await accessOwner(app, request, reply, env);
        if (!access) return;
        const q = request.query || {};
        const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
            Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
        if ((q.from && !validDate(q.from)) || (q.to && !validDate(q.to)) ||
            (q.from && q.to && q.from > q.to) || (q.search != null && (typeof q.search !== 'string' || q.search.length > 200)) ||
            (q.offset != null && !/^\d{1,7}$/.test(q.offset))) return invalidBody(reply);
        const offset = Number(q.offset || 0);
        const result = await app.db.query(`with receipts as (
            select a.id, a.created_at, a.target_id as menu_id, a.actor_user_id,
                a.details->>'quantity' as quantity, a.details->>'before' as before, a.details->>'after' as after,
                a.details->>'note' as note,
                coalesce(a.details->>'menu_name', m.name, 'สินค้าที่ถูกลบ') as menu_name,
                case when a.details ? 'snapshot_version' then a.details->>'barcode' else m.stock_barcode end as barcode,
                case when a.details ? 'snapshot_version' then a.details->>'unit' else m.unit end as unit,
                coalesce(a.details->>'actor_name', u.display_name, u.email, 'ไม่ระบุผู้รับ') as actor_name,
                not (a.details ? 'snapshot_version') as legacy
            from audit_logs a
            left join menus m on m.id = a.target_id and m.restaurant_id = a.restaurant_id
            left join app_users u on u.id = a.actor_user_id
            where a.restaurant_id = $1 and a.action = 'menu.stock_adjustment' and a.details->>'movement_type' = 'purchase'
                and ($2::date is null or a.created_at >= ($2::date::timestamp at time zone 'Asia/Vientiane'))
                and ($3::date is null or a.created_at < (($3::date + 1)::timestamp at time zone 'Asia/Vientiane'))
        ), filtered as (
            select * from receipts where $4 = '' or strpos(lower(concat_ws(' ', menu_name, barcode, actor_name, note, id::text)), lower($4)) > 0
        ), page as (select * from filtered order by created_at desc, id desc limit 50 offset $5)
        select (select count(*)::int from filtered) as total,
            (select count(distinct menu_id)::int from filtered) as products,
            coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc, id desc) from page), '[]'::jsonb) as receipts`,
        [access.restaurantId, q.from || null, q.to || null, q.search?.trim() || '', offset]);
        return reply.send({ok:true, ...result.rows[0], offset, limit:50});
    };
  return { get_api_restaurants_restaurantId_menu_receipts };
}


