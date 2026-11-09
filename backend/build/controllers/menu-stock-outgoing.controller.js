import { receiptSnapshot } from './menu-stock-history.controller.js';
import { outgoingCsv } from '../routes/menu-stock-export.js';
export async function recordOrderMenuMovement(client, restaurantId, orderId, actorUserId, menu, quantity, returning = false) {
    const order = (await client.query(`select o.receipt_number, t.table_number::text as table_name
        from orders o left join tables t on t.id=o.table_id and t.restaurant_id=o.restaurant_id
        where o.id=$1 and o.restaurant_id=$2`, [orderId, restaurantId])).rows[0];
    const after = Number(menu.stock_quantity);
    const before = Math.round((after + (returning ? -quantity : quantity)) * 1000) / 1000;
    const details = { ...await receiptSnapshot(client, menu, actorUserId), quantity, before, after,
        order_id: orderId, receipt_number: order?.receipt_number || null, table_name: order?.table_name || null };
    await client.query(`insert into audit_logs(restaurant_id,actor_user_id,action,target_id,details)
        values($1,$2,$3,$4,$5::jsonb)`, [restaurantId, actorUserId, returning ? 'menu.stock_sale_return' : 'menu.stock_sale', menu.id, JSON.stringify(details)]);
}
export function createMenuStockOutgoingController(app, env, { accessOwner, invalidBody }) {
    const get_api_restaurants_restaurantId_menu_outgoing = async (request, reply) => {
        const access = await accessOwner(app, request, reply, env);
        if (!access)
            return;
        const q = request.query || {};
        const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
        if ((q.from && !date(q.from)) || (q.to && !date(q.to)) || (q.from && q.to && q.from > q.to) ||
            (q.search != null && (typeof q.search !== 'string' || q.search.length > 200)) ||
            (q.offset != null && !/^\d{1,7}$/.test(q.offset)) || (q.format != null && q.format !== 'csv') ||
            (q.locale != null && !['th', 'lo', 'en'].includes(q.locale)) ||
            (q.type && !['sale', 'issue', 'waste', 'return_out', 'adjustment', 'transfer_out', 'sale_return', 'legacy'].includes(q.type)))
            return invalidBody(reply);
        const result = await app.db.query(`with events as (
            select a.id::text, a.created_at, a.target_id as menu_id,
                case a.action when 'menu.stock_sale' then 'sale' when 'menu.stock_sale_return' then 'sale_return'
                    when 'menu.stock_transfer_out' then 'transfer_out' else a.details->>'movement_type' end as type,
                case when a.details->>'movement_type'='adjustment' then
                    ((a.details->>'before')::numeric-(a.details->>'after')::numeric)::text else a.details->>'quantity' end as quantity,
                a.details->>'before' as before, a.details->>'after' as after, a.details->>'note' as note,
                coalesce(a.details->>'menu_name',m.name,'สินค้าที่ถูกลบ') as menu_name,
                case when a.details ? 'snapshot_version' then a.details->>'barcode' else m.stock_barcode end as barcode,
                case when a.details ? 'snapshot_version' then a.details->>'unit' else m.unit end as unit,
                coalesce(a.details->>'actor_name',u.display_name,u.email,'ไม่ระบุผู้ทำรายการ') as actor_name,
                not (a.details ? 'snapshot_version') as legacy,
                a.details->>'order_id' as order_id, coalesce(a.details->>'receipt_number',o.receipt_number) as receipt_number,
                a.details->>'table_name' as table_name, o.paid, o.status::text as order_status, o.cancel_reason,
                (o.stock_reversed_at is not null) as reversed
            from audit_logs a
            left join menus m on m.id=a.target_id and m.restaurant_id=a.restaurant_id
            left join app_users u on u.id=a.actor_user_id
            left join orders o on o.id::text=a.details->>'order_id' and o.restaurant_id=a.restaurant_id
            where a.restaurant_id=$1 and (
                a.action in ('menu.stock_sale','menu.stock_sale_return','menu.stock_transfer_out') or
                (a.action='menu.stock_adjustment' and (a.details->>'movement_type' in ('issue','waste','return_out') or
                  (a.details->>'movement_type'='adjustment' and (a.details->>'after')::numeric < (a.details->>'before')::numeric))))
            union all
            -- Old orders prove what was ordered, but not which menu stock was tracked.
            -- Keep these explicitly separate from verified stock movements.
            select 'legacy:'||o.id::text||':'||line.menu_id::text, o.stock_applied_at, line.menu_id,
                'legacy', sum(line.qty)::text, null, null, null,
                coalesce(max(line.name),max(m.name),'สินค้าที่ถูกลบ'), null, null,
                'ไม่ได้บันทึกผู้ตัดสต็อก', true, o.id::text, o.receipt_number, t.table_number::text,
                o.paid, o.status::text, o.cancel_reason, (o.stock_reversed_at is not null)
            from orders o cross join lateral jsonb_to_recordset(o.items) as line(menu_id uuid,name text,qty numeric)
            left join menus m on m.id=line.menu_id and m.restaurant_id=o.restaurant_id
            left join tables t on t.id=o.table_id and t.restaurant_id=o.restaurant_id
            where o.restaurant_id=$1 and o.stock_applied_at is not null and not exists (
                select 1 from audit_logs a where a.restaurant_id=o.restaurant_id and
                    ((a.action='order.stock_applied' and a.target_id=o.id) or
                     (a.action='menu.stock_sale' and a.details->>'order_id'=o.id::text)))
            group by o.id,o.stock_applied_at,line.menu_id,o.receipt_number,t.table_number,o.paid,o.status,o.cancel_reason,o.stock_reversed_at
        ), filtered as (
            select * from events where ($2::date is null or created_at>=($2::date::timestamp at time zone 'Asia/Vientiane'))
                and ($3::date is null or created_at<(($3::date+1)::timestamp at time zone 'Asia/Vientiane'))
                and ($4='' or strpos(lower(concat_ws(' ',menu_name,barcode,actor_name,note,id,order_id,receipt_number,table_name)),lower($4))>0)
                and ($5='' or type=$5)
        ), page as (select * from filtered order by created_at desc,id desc limit $7 offset $6)
        select (select count(*)::int from filtered) as total,
            (select count(distinct menu_id)::int from filtered) as products,
            coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc,id desc) from page),'[]'::jsonb) as receipts`, [access.restaurantId, q.from || null, q.to || null, q.search?.trim() || '', q.type || '', q.format === 'csv' ? 0 : Number(q.offset || 0), q.format === 'csv' ? null : 50]);
        if (q.format === 'csv')
            return reply.send({ ok: true, total: result.rows[0].total, csv: outgoingCsv(result.rows[0].receipts, q.locale || 'th') });
        return reply.send({ ok: true, ...result.rows[0], offset: Number(q.offset || 0), limit: 50 });
    };
    return { get_api_restaurants_restaurantId_menu_outgoing };
}
