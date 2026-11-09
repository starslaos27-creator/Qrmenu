import { access, ledger, range, timeRange, uuid, date, clean, bad } from '../controllers/finance.controller.js';
import { requireRestaurantAccess } from '../security/authorization.js';
const methods = ['cash', 'transfer', 'qr', 'card', 'other'];
const money = v => typeof v === 'string' && /^\d{1,12}(\.\d{1,2})?$/.test(v);
const signed = v => typeof v === 'string' && /^-?\d{1,12}(\.\d{1,2})?$/.test(v);
const defaults = { incomeCategories: ['รายรับอื่น ๆ'], expenseCategories: ['ซื้อวัตถุดิบ', 'ค่าเช่า', 'ค่าไฟ', 'ค่าน้ำ', 'ค่าแรง', 'ค่าอุปกรณ์', 'ค่าใช้จ่ายอื่น ๆ'], viewRoles: [], editRoles: [], currency: 'LAK', paymentMethods: methods };
const mojibake = value => new TextDecoder('windows-1252').decode(Buffer.from(value, 'utf8'));
function normalizeConfig(saved = {}) {
    const config = { ...defaults, ...saved };
    for (const key of ['incomeCategories', 'expenseCategories']) {
        const legacy = new Map(defaults[key].map(value => [mojibake(value), value]));
        if (Array.isArray(config[key]))
            config[key] = config[key].map(value => legacy.get(value) ?? value);
    }
    return config;
}
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Vientiane', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
async function audit(db, r, user, action, details) { await db.query('insert into audit_logs(restaurant_id,actor_user_id,action,details) values($1,$2,$3,$4)', [r, user, action, JSON.stringify(details)]); }
async function accounts(db, r, to, toTime = '23:59') {
    return (await db.query(`with flows as (
  select split.method,(o.paid_at at time zone 'Asia/Vientiane')::date d,o.paid_at ts,split.amount from orders o
   left join bill_payment_details p on p.restaurant_id=o.restaurant_id and p.receipt_number=o.receipt_number and p.reopened_at is null
   cross join lateral (values
    (case when p.payment_method='mixed' then 'cash' when o.payment_method='promptpay' then 'qr' else coalesce(o.payment_method,'other') end,
     case when p.payment_method='mixed' then p.bill_total-p.transfer_amount else coalesce(o.settled_total,o.total) end),
    (case when p.payment_method='mixed' then 'transfer' end,case when p.payment_method='mixed' then p.transfer_amount end)
   ) split(method,amount)
   where o.restaurant_id=$1 and o.paid and o.paid_at is not null and o.status<>'cancelled' and split.amount>0
  union all select payment_method,entry_date,created_at,case when kind='income' then amount else -amount end
   from finance_entries where restaurant_id=$1 and voided_at is null
  union all select from_method,entry_date,created_at,-amount from finance_transfers where restaurant_id=$1
  union all select to_method,entry_date,created_at,amount from finance_transfers where restaurant_id=$1
 ) select m.method,a.name,a.opening_date::text,a.opening_balance::text,
  coalesce(sum(f.amount) filter(where f.amount>0),0)::text income,
  coalesce(-sum(f.amount) filter(where f.amount<0),0)::text expense,
  (coalesce(a.opening_balance,0)+coalesce(sum(f.amount),0))::text balance,
  (a.method is not null and a.opening_date<=$2::date) configured
 from unnest($3::text[]) m(method)
 left join finance_accounts a on a.restaurant_id=$1 and a.method=m.method
 left join flows f on f.method=m.method and f.d>=coalesce(a.opening_date,'2000-01-01') and f.d<=$2::date and f.ts < (($2::date+$4::time+interval '1 minute') at time zone 'Asia/Vientiane')
 group by m.method,a.method,a.name,a.opening_date,a.opening_balance`, [r, to, methods, toTime])).rows;
}
async function period(db, r, from, to, fromTime, toTime) {
    return (await db.query(ledger + ` select
 coalesce(sum(amount) filter(where kind='income' and voided_at is null),0)::text income,
 coalesce(sum(amount) filter(where source='sale'),0)::text sales,
 coalesce(sum(amount) filter(where kind='expense' and treatment='operating' and voided_at is null),0)::text expense,
 coalesce(sum(amount) filter(where kind='cost'),0)::text cost,
 coalesce(sum(amount) filter(where kind='expense' and treatment='inventory' and voided_at is null),0)::text "inventoryPurchases",
 coalesce(sum(case when kind='income' then amount else -amount end) filter(where treatment='operating' and voided_at is null),0)::text net
 from ledger`, [r, from, to, fromTime, toTime])).rows[0];
}
export function createFinanceWorkspaceController(app, env) {
    const base = '/api/restaurants/:restaurantId/finance';
    const handler1 = async (req, reply) => {
        if (!uuid(req.params.restaurantId))
            return bad(reply);
        const a = await requireRestaurantAccess(req, reply, env, req.params.restaurantId);
        if (!a)
            return;
        const c = normalizeConfig((await app.db.query('select config from finance_settings where restaurant_id=$1', [a.restaurantId])).rows[0]?.config);
        return { ok: true, view: a.role === 'owner' || c.viewRoles.includes(a.role) || c.editRoles.includes(a.role), edit: a.role === 'owner' || c.editRoles.includes(a.role), owner: a.role === 'owner' };
    };
    const handler2 = async (req, reply) => {
        const a = await access(req, reply, env);
        if (!a)
            return;
        if (!range(req.query) || !timeRange(req.query))
            return bad(reply);
        const { from, to } = req.query, fromTime = req.query.fromTime ?? '00:00', toTime = req.query.toTime ?? '23:59', r = a.restaurantId, day = today();
        const db = await app.db.connect();
        try {
            await db.query('begin isolation level repeatable read read only');
            const current = await period(db, r, day, day, fromTime, toTime), month = await period(db, r, day.slice(0, 8) + '01', day, fromTime, toTime), selected = await period(db, r, from, to, fromTime, toTime);
            const bills = (await db.query(`select count(distinct coalesce(receipt_number,id::text))::int count from orders where restaurant_id=$1 and paid and status<>'cancelled' and paid_at >= (($2::date+$3::time) at time zone 'Asia/Vientiane') and paid_at < (($2::date+$4::time+interval '1 minute') at time zone 'Asia/Vientiane')`, [r, day, fromTime, toTime])).rows[0].count;
            const payments = (await db.query(ledger + ` select case when payment_method='promptpay' then 'qr' else payment_method end method,sum(amount)::text amount from ledger where source='sale' group by 1`, [r, day, day, fromTime, toTime])).rows;
            const menus = (await db.query(`select coalesce(x->>'menu_id','unknown') id,coalesce(max(x->>'name'),max(m.name),'เมนูที่ลบแล้ว') name,
    sum(case when (x->>'qty') ~ '^\d+(\.\d+)?$' then (x->>'qty')::numeric else 0 end)::text quantity,
    sum(case when o.subtotal>0 then coalesce(o.settled_total,o.total)*coalesce((x->>'unit_price')::numeric,0)*coalesce((x->>'qty')::numeric,0)/o.subtotal else 0 end)::numeric(20,2)::text sales
    from (select *, (select sum(coalesce((i->>'unit_price')::numeric,0)*coalesce((i->>'qty')::numeric,0)) from jsonb_array_elements(items) i) subtotal from orders where restaurant_id=$1 and paid and status<>'cancelled' and paid_at >= (($2::date+$4::time) at time zone 'Asia/Vientiane') and paid_at < (($3::date+$5::time+interval '1 minute') at time zone 'Asia/Vientiane')) o
    cross join lateral jsonb_array_elements(o.items) x left join menus m on m.id::text=x->>'menu_id' and m.restaurant_id=$1 group by x->>'menu_id' order by sum(coalesce((x->>'qty')::numeric,0)) desc`, [r, from, to, fromTime, toTime])).rows;
            const staff = (await db.query(`select coalesce(nullif(receipt_user,''),'ไม่ระบุผู้รับชำระ') name,count(distinct coalesce(receipt_number,id::text))::int bills,sum(coalesce(settled_total,total))::text sales from orders where restaurant_id=$1 and paid and status<>'cancelled' and paid_at >= (($2::date+$4::time) at time zone 'Asia/Vientiane') and paid_at < (($3::date+$5::time+interval '1 minute') at time zone 'Asia/Vientiane') group by 1 order by sum(coalesce(settled_total,total)) desc`, [r, from, to, fromTime, toTime])).rows;
            const costs = (await db.query(`select m.id,m.name,m.price::text,m.cost_price::text,
    coalesce(json_agg(json_build_object('id',i.id,'name',i.name,'unit',i.unit,'quantity',c.quantity::text,'unit_cost',p.unit_cost::text)) filter(where c.menu_id is not null),'[]') components,
    case when count(c.menu_id)>0 then sum(c.quantity*p.unit_cost) else m.cost_price end::text recipe_cost,
    count(*) filter(where c.menu_id is not null and p.unit_cost is null)::int missing
    from menus m left join menu_inventory_components c on c.menu_id=m.id
    left join inventory_items i on i.id=c.inventory_item_id and i.restaurant_id=$1
    left join lateral(select sm.unit_cost from stock_movements sm where sm.restaurant_id=$1 and sm.inventory_item_id=c.inventory_item_id and sm.quantity_delta>0 and sm.unit_cost is not null order by sm.occurred_at desc,sm.id desc limit 1)p on true
    where m.restaurant_id=$1 group by m.id order by m.name`, [r])).rows;
            const ingredients = (await db.query(`select i.id,i.name,i.unit,p.unit_cost::text,
    coalesce((select sum(quantity) from inventory_balances where inventory_item_id=i.id),0)::text balance,
    coalesce((select -sum(quantity_delta) from stock_movements where restaurant_id=$1 and inventory_item_id=i.id and reference_type='order' and movement_type in ('recipe_consumption','return_in') and occurred_at >= (($2::date+$4::time) at time zone 'Asia/Vientiane') and occurred_at < (($3::date+$5::time+interval '1 minute') at time zone 'Asia/Vientiane')),0)::text used
    from inventory_items i left join lateral(select unit_cost from stock_movements where restaurant_id=$1 and inventory_item_id=i.id and quantity_delta>0 and unit_cost is not null order by occurred_at desc,id desc limit 1)p on true where i.restaurant_id=$1 order by i.name`, [r, from, to, fromTime, toTime])).rows;
            const config = normalizeConfig((await db.query('select config from finance_settings where restaurant_id=$1', [r])).rows[0]?.config);
            const restaurant = (await db.query(`select vat_pct::text,service_charge_pct::text,currency_code,
    not (exists(select 1 from orders where restaurant_id=$1)
      or exists(select 1 from finance_entries where restaurant_id=$1)
      or exists(select 1 from finance_transfers where restaurant_id=$1)
      or exists(select 1 from finance_closings where restaurant_id=$1)
      or exists(select 1 from finance_accounts where restaurant_id=$1)
      or exists(select 1 from stock_movements where restaurant_id=$1)) currency_editable
    from restaurants where id=$1`, [r])).rows[0];
            config.currency = restaurant.currency_code;
            const balances = await accounts(db, r, to);
            const closings = (await db.query(`select c.id,c.close_date::text,c.snapshot,c.actual,c.note,c.created_at,coalesce(u.display_name,u.email) operator from finance_closings c left join app_users u on u.id=c.created_by where c.restaurant_id=$1 order by close_date desc,created_at desc limit 60`, [r])).rows;
            const transfers = (await db.query(`select t.*,coalesce(u.display_name,u.email) operator from finance_transfers t left join app_users u on u.id=t.created_by where t.restaurant_id=$1 and t.entry_date between $2 and $3 and (t.entry_date>$2::date or (t.created_at at time zone 'Asia/Vientiane')::time >= $4::time) and (t.entry_date<$3::date or date_trunc('minute',t.created_at at time zone 'Asia/Vientiane')::time <= $5::time) order by t.created_at desc limit 100`, [r, from, to, fromTime, toTime])).rows;
            await db.query('commit');
            return { ok: true, today: current, month, bills, payments, selected, menus, staff, costs, ingredients, config, restaurant, currencyEditable: restaurant.currency_editable, accounts: balances, closings, transfers, day, canEdit: a.role === 'owner' || config.editRoles.includes(a.role), isOwner: a.role === 'owner' };
        }
        catch (e) {
            await db.query('rollback');
            throw e;
        }
        finally {
            db.release();
        }
    };
    const handler3 = async (req, reply) => {
        const a = await requireRestaurantAccess(req, reply, env, req.params.restaurantId, ['owner']);
        if (!a)
            return;
        const b = req.body || {};
        for (const key of ['incomeCategories', 'expenseCategories'])
            if (!Array.isArray(b[key]) || !b[key].length || b[key].length > 50 || !b[key].every(v => clean(v, 100, true)))
                return bad(reply);
        for (const key of ['viewRoles', 'editRoles'])
            if (!Array.isArray(b[key]) || !b[key].every(v => ['cook', 'waiter', 'staff'].includes(v)))
                return bad(reply);
        if (!['LAK', 'THB', 'USD'].includes(b.currency) || !Array.isArray(b.paymentMethods) || !b.paymentMethods.length || !b.paymentMethods.every(v => methods.includes(v)))
            return bad(reply);
        if ((b.vatPct !== undefined || b.serviceChargePct !== undefined) && ![b.vatPct, b.serviceChargePct].every(v => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100))
            return bad(reply);
        const config = Object.fromEntries(Object.keys(defaults).map(k => [k, b[k]]));
        const db = await app.db.connect();
        try {
            await db.query('begin');
            const current = (await db.query('select currency_code from restaurants where id=$1 for update', [a.restaurantId])).rows[0];
            if (!current) {
                await db.query('rollback');
                return bad(reply);
            }
            if (b.currency !== current.currency_code) {
                const activity = await db.query(`select exists(select 1 from orders where restaurant_id=$1)
      or exists(select 1 from finance_entries where restaurant_id=$1)
      or exists(select 1 from finance_transfers where restaurant_id=$1)
      or exists(select 1 from finance_closings where restaurant_id=$1)
      or exists(select 1 from finance_accounts where restaurant_id=$1)
      or exists(select 1 from stock_movements where restaurant_id=$1) locked`, [a.restaurantId]);
                if (activity.rows[0].locked) {
                    await db.query('rollback');
                    return reply.code(409).send({ error: 'CURRENCY_LOCKED' });
                }
                await db.query('update restaurants set currency_code=$2 where id=$1', [a.restaurantId, b.currency]);
            }
            await db.query('insert into finance_settings(restaurant_id,config) values($1,$2) on conflict(restaurant_id) do update set config=excluded.config,updated_at=now()', [a.restaurantId, JSON.stringify(config)]);
            if (b.vatPct !== undefined)
                await db.query('update restaurants set vat_pct=$2,service_charge_pct=$3 where id=$1', [a.restaurantId, b.vatPct, b.serviceChargePct]);
            await audit(db, a.restaurantId, a.user.id, 'finance.settings', { ...config, vatPct: b.vatPct, serviceChargePct: b.serviceChargePct });
            await db.query('commit');
            return { ok: true };
        }
        catch (e) {
            await db.query('rollback');
            throw e;
        }
        finally {
            db.release();
        }
    };
    const handler4 = async (req, reply) => {
        const a = await requireRestaurantAccess(req, reply, env, req.params.restaurantId, ['owner']);
        if (!a)
            return;
        const b = req.body || {}, method = req.params.method;
        if (!methods.includes(method) || !clean(b.name, 100, true) || !date(b.date) || !signed(b.balance))
            return bad(reply);
        const db = await app.db.connect();
        try {
            await db.query('begin');
            await db.query(`insert into finance_accounts(restaurant_id,method,name,opening_date,opening_balance,updated_by) values($1,$2,$3,$4,$5,$6) on conflict(restaurant_id,method) do update set name=excluded.name,opening_date=excluded.opening_date,opening_balance=excluded.opening_balance,updated_by=excluded.updated_by`, [a.restaurantId, method, b.name.trim(), b.date, b.balance, a.user.id]);
            await audit(db, a.restaurantId, a.user.id, 'finance.account', { method, ...b });
            await db.query('commit');
            return { ok: true };
        }
        catch (e) {
            await db.query('rollback');
            throw e;
        }
        finally {
            db.release();
        }
    };
    const handler5 = async (req, reply) => {
        const a = await access(req, reply, env);
        if (!a)
            return;
        const b = req.body || {};
        if (!methods.includes(b.from) || !methods.includes(b.to) || b.from === b.to || !money(b.amount) || Number(b.amount) <= 0 || !date(b.date) || !uuid(b.requestId) || !clean(b.note, 500, true))
            return bad(reply);
        const result = await app.db.query(`insert into finance_transfers(restaurant_id,from_method,to_method,amount,entry_date,note,request_id,created_by) values($1,$2,$3,$4,$5,$6,$7,$8) on conflict(restaurant_id,request_id) do nothing returning id`, [a.restaurantId, b.from, b.to, b.amount, b.date, b.note, b.requestId, a.user.id]);
        if (!result.rowCount) {
            const p = (await app.db.query('select *,entry_date::text as day from finance_transfers where restaurant_id=$1 and request_id=$2', [a.restaurantId, b.requestId])).rows[0];
            if (p.from_method !== b.from || p.to_method !== b.to || Number(p.amount) !== Number(b.amount) || p.note !== b.note || p.day !== b.date)
                return reply.code(409).send({ error: 'FINANCE_REQUEST_CONFLICT' });
        }
        return { ok: true };
    };
    const handler6 = async (req, reply) => { const a = await access(req, reply, env); if (!a)
        return; const day = req.query.date, fromTime = req.query.fromTime ?? '00:00', toTime = req.query.toTime ?? '23:59'; if (!date(day) || day > today() || !timeRange({ from: day, to: day, fromTime, toTime }))
        return bad(reply); return { ok: true, accounts: await accounts(app.db, a.restaurantId, day, toTime), summary: await period(app.db, a.restaurantId, day, day, fromTime, toTime) }; };
    const handler7 = async (req, reply) => {
        const a = await access(req, reply, env);
        if (!a)
            return;
        const b = req.body || {};
        const fromTime = b.fromTime ?? '00:00', toTime = b.toTime ?? '23:59';
        if (!date(b.date) || b.date > today() || !timeRange({ from: b.date, to: b.date, fromTime, toTime }) || !uuid(b.requestId) || !clean(b.note ?? '', 1000) || !b.actual || !methods.every(m => signed(b.actual[m])))
            return bad(reply);
        const db = await app.db.connect();
        try {
            await db.query('begin isolation level repeatable read');
            const balances = await accounts(db, a.restaurantId, b.date, toTime), summary = await period(db, a.restaurantId, b.date, b.date, fromTime, toTime);
            if (balances.some(x => !x.configured)) {
                await db.query('rollback');
                return reply.code(409).send({ error: 'ACCOUNT_OPENING_REQUIRED' });
            }
            const snapshot = { accounts: balances, summary, period: { fromTime, toTime } };
            const inserted = await db.query(`insert into finance_closings(restaurant_id,close_date,snapshot,actual,note,request_id,created_by) values($1,$2,$3,$4,$5,$6,$7) on conflict(restaurant_id,request_id) do nothing returning id`, [a.restaurantId, b.date, JSON.stringify(snapshot), JSON.stringify(b.actual), b.note || '', b.requestId, a.user.id]);
            if (!inserted.rowCount) {
                const p = (await db.query('select close_date::text,actual,note,snapshot from finance_closings where restaurant_id=$1 and request_id=$2', [a.restaurantId, b.requestId])).rows[0];
                if (p.close_date !== b.date || p.note !== (b.note || '') || (p.snapshot?.period?.fromTime ?? '00:00') !== fromTime || (p.snapshot?.period?.toTime ?? '23:59') !== toTime || methods.some(m => Number(p.actual[m]) !== Number(b.actual[m]))) {
                    await db.query('rollback');
                    return reply.code(409).send({ error: 'FINANCE_REQUEST_CONFLICT' });
                }
            }
            await db.query('commit');
            return { ok: true, snapshot };
        }
        catch (e) {
            await db.query('rollback');
            throw e;
        }
        finally {
            db.release();
        }
    };
    const handler8 = async (req, reply) => {
        const a = await access(req, reply, env);
        if (!a)
            return;
        const part = await req.file({ limits: { files: 1, fileSize: 5242880 } });
        if (!part || !['image/jpeg', 'image/png', 'image/webp'].includes(part.mimetype))
            return bad(reply);
        let body;
        try {
            body = await part.toBuffer();
        }
        catch {
            return reply.code(413).send({ error: 'RECEIPT_TOO_LARGE' });
        }
        if (part.file.truncated)
            return reply.code(413).send({ error: 'RECEIPT_TOO_LARGE' });
        const valid = part.mimetype === 'image/png' ? body.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) : part.mimetype === 'image/jpeg' ? body[0] === 255 && body[1] === 216 && body[2] === 255 : body.toString('ascii', 0, 4) === 'RIFF' && body.toString('ascii', 8, 12) === 'WEBP';
        if (!valid)
            return bad(reply);
        const result = await app.db.query('insert into finance_receipts(restaurant_id,filename,mime,body,created_by) values($1,$2,$3,$4,$5) returning id', [a.restaurantId, String(part.filename || 'receipt').slice(0, 200), part.mimetype, body, a.user.id]);
        return reply.code(201).send({ ok: true, id: result.rows[0].id });
    };
    const handler9 = async (req, reply) => { const a = await access(req, reply, env); if (!a)
        return; if (!uuid(req.params.receiptId))
        return bad(reply); const row = (await app.db.query('select mime,body from finance_receipts where restaurant_id=$1 and id=$2', [a.restaurantId, req.params.receiptId])).rows[0]; if (!row)
        return reply.code(404).send({ error: 'NOT_FOUND' }); reply.header('Cache-Control', 'no-store'); return { ok: true, dataUrl: `data:${row.mime};base64,${row.body.toString('base64')}` }; };
    return { base, handler1, handler2, handler3, handler4, handler5, handler6, handler7, handler8, handler9 };
}
