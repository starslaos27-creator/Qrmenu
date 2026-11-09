import { requireRestaurantAccess } from '../security/authorization.js';
export const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export const date = value => typeof value === 'string' && /^20\d{2}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
export const clean = (value, max, required = false) => typeof value === 'string' && value.trim().length <= max && (!required || value.trim().length > 0);
export const bad = reply => reply.code(400).send({ ok: false, error: 'INVALID_FINANCE_INPUT' });
export const timeRange = query => {
    const fromTime = query.fromTime ?? '00:00', toTime = query.toTime ?? '23:59';
    const valid = v => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
    return valid(fromTime) && valid(toTime) && (query.from !== query.to || fromTime <= toTime);
};
export async function access(request, reply, env) {
    if (!uuid(request.params.restaurantId)) {
        bad(reply);
        return null;
    }
    const auth = await requireRestaurantAccess(request, reply, env, request.params.restaurantId);
    if (!auth || auth.role === 'owner')
        return auth;
    const config = (await request.server.db.query('select config from finance_settings where restaurant_id=$1', [auth.restaurantId])).rows[0]?.config || {};
    const allowed = request.method === 'GET' ? [...(config.viewRoles || []), ...(config.editRoles || [])] : config.editRoles || [];
    if (!allowed.includes(auth.role)) {
        reply.code(403).send({ ok: false, error: 'FORBIDDEN' });
        return null;
    }
    return auth;
}
// Automatic receipts always follow payment time (UTC+7), never menu prices or order creation time.
export const ledger = `with payment_alloc as (
 select o.*,p.payment_method as detail_method,coalesce(p.transfer_amount,0)::numeric as bill_transfer,
        p.bill_total::numeric as payment_total,coalesce(o.settled_total,o.total)::numeric as bill_share,
        row_number() over(partition by o.restaurant_id,o.receipt_number order by o.id) as row_n,
        count(*) over(partition by o.restaurant_id,o.receipt_number) as row_count
 from orders o left join bill_payment_details p
   on p.restaurant_id=o.restaurant_id and p.receipt_number=o.receipt_number and p.reopened_at is null
 where o.restaurant_id=$1 and o.paid=true and o.paid_at is not null and o.status<>'cancelled'
   and o.paid_at >= (($2::date+$4::time) at time zone 'Asia/Vientiane')
   and o.paid_at < (($3::date+$5::time+interval '1 minute') at time zone 'Asia/Vientiane')
), allocated as (
 select *,case when detail_method='mixed' and row_n=row_count then
   bill_transfer-coalesce(sum(round(bill_transfer*bill_share/nullif(payment_total,0),2)) over(
     partition by restaurant_id,receipt_number order by row_n rows between unbounded preceding and 1 preceding),0)
   when detail_method='mixed' then round(bill_transfer*bill_share/nullif(payment_total,0),2)
   when detail_method in ('transfer','promptpay') then bill_share else 0 end as transfer_share
 from payment_alloc
), ledger as (
 select case when a.detail_method='mixed' then md5(a.id::text||':'||split.method)::uuid else a.id end id,
   'sale'::text source,'income'::text kind,split.amount::numeric amount,(select currency_code from restaurants where id=$1)::text currency_code,split.amount::numeric currency_amount,1::numeric exchange_rate,
   (a.paid_at at time zone 'Asia/Vientiane')::date entry_date,
   '\u0e22\u0e2d\u0e14\u0e02\u0e32\u0e22\u0e2d\u0e32\u0e2b\u0e32\u0e23'::text category,('\u0e23\u0e31\u0e1a\u0e0a\u0e33\u0e23\u0e30\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c #'||left(a.id::text,8))::text description,
   coalesce(split.method,a.payment_method,'other') payment_method,''::text reference,
   a.paid_at created_at,null::timestamptz voided_at,null::text void_reason,false cost_incomplete,'operating'::text treatment
 from allocated a
 cross join lateral (values
   (case when a.detail_method='mixed' then 'cash'::text end,case when a.detail_method='mixed' then a.bill_share-a.transfer_share end),
   (case when a.detail_method='mixed' then 'transfer'::text end,case when a.detail_method='mixed' then a.transfer_share end),
   (case when a.detail_method is distinct from 'mixed' then coalesce(a.payment_method,'other') end,case when a.detail_method is distinct from 'mixed' then a.bill_share end)
 ) split(method,amount)
 where split.amount>0
 union all
 select id,'manual',kind,amount,currency_code,currency_amount,exchange_rate,entry_date,category,description,payment_method,reference,created_at,voided_at,void_reason,false,treatment
 from finance_entries where restaurant_id=$1 and entry_date between $2::date and $3::date
 and (entry_date>$2::date or (created_at at time zone 'Asia/Vientiane')::time >= $4::time)
 and (entry_date<$3::date or date_trunc('minute',created_at at time zone 'Asia/Vientiane')::time <= $5::time)
 union all
 select id,'cost','cost',coalesce(cost_total,0),(select currency_code from restaurants where id=$1)::text,coalesce(cost_total,0),1::numeric,
 (paid_at at time zone 'Asia/Vientiane')::date,'\u0e15\u0e49\u0e19\u0e17\u0e38\u0e19\u0e40\u0e21\u0e19\u0e39',('\u0e15\u0e49\u0e19\u0e17\u0e38\u0e19\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c #'||left(id::text,8)), 'other','',paid_at,null::timestamptz,null::text,
 (cost_total is null or coalesce(cost_missing_count,1)>0),'operating'
 from orders where restaurant_id=$1 and paid=true and paid_at is not null and status<>'cancelled'
 and paid_at >= (($2::date+$4::time) at time zone 'Asia/Vientiane')
 and paid_at < (($3::date+$5::time+interval '1 minute') at time zone 'Asia/Vientiane')
 )`;
export function range(query) { return date(query.from) && date(query.to) && query.from <= query.to && (Date.parse(query.to) - Date.parse(query.from)) / 86400000 <= 366; }
export function csvCell(value) { let text = String(value ?? ''); if (/^[=+\-@\t\r\n]/.test(text))
    text = "'" + text; return '"' + text.replaceAll('"', '""') + '"'; }
const currencyCodes = ['LAK', 'THB', 'USD'];
const validExchangeRate = value => typeof value === 'string' && /^\d{1,12}(\.\d{1,8})?$/.test(value) && Number(value) > 0;
function financeCsvRows(rows, locale) {
    const labels = locale === 'en' ? {
        headers: ['Date', 'Type', 'Source', 'Category', 'Description', 'Amount (LAK)', 'Method', 'Reference', 'Status', 'Void reason', 'Entry ID', 'Cost complete', 'Profit treatment', 'Bill number', 'Table', 'Recorded by / cashier', 'Recorded at', 'Replaces', 'Currency', 'Original amount', 'Exchange rate to LAK'],
        kinds: { income: 'Income', expense: 'Expense', cost: 'Cost' }, sources: { sale: 'Sale', manual: 'Manual', cost: 'Cost' }, methods: { cash: 'Cash', transfer: 'Transfer', qr: 'QR payment', card: 'Card', other: 'Other' }, treatments: { operating: 'Operating', inventory: 'Inventory' }, active: 'Active', void: 'Voided', complete: 'Complete', incomplete: 'Incomplete', food: 'Food sales', menuCost: 'Menu cost', salePrefix: 'Order payment #', costPrefix: 'Order cost #'
    } : locale === 'lo' ? {
        headers: ['ວັນທີ', 'ປະເພດ', 'ແຫຼ່ງຂໍ້ມູນ', 'ໝວດໝູ່', 'ລາຍລະອຽດ', 'ຈຳນວນເງິນ (LAK)', 'ຊ່ອງທາງ', 'ເລກອ້າງອີງ', 'ສະຖານະ', 'ເຫດຜົນຍົກເລີກ', 'ລະຫັດລາຍການ', 'ຕົ້ນທຶນຄົບຖ້ວນ', 'ການຄິດກຳໄລ', 'ເລກບິນ', 'ໂຕະ', 'ຜູ້ບັນທຶກ/ຜູ້ຮັບຊຳລະ', 'ວັນເວລາບັນທຶກ', 'ແທນລາຍການ', 'Currency', 'Original amount', 'Exchange rate to LAK'],
        kinds: { income: 'ລາຍຮັບ', expense: 'ລາຍຈ່າຍ', cost: 'ຕົ້ນທຶນ' }, sources: { sale: 'ຂາຍ', manual: 'ບັນທຶກເອງ', cost: 'ຕົ້ນທຶນ' }, methods: { cash: 'ເງິນສົດ', transfer: 'ໂອນເງິນ', qr: 'ຊຳລະ QR', card: 'ບັດ', other: 'ອື່ນໆ' }, treatments: { operating: 'ດຳເນີນງານ', inventory: 'ສະຕັອກ' }, active: 'ໃຊ້ງານ', void: 'ຍົກເລີກແລ້ວ', complete: 'ຄົບ', incomplete: 'ບໍ່ຄົບ', food: 'ຂາຍອາຫານ', menuCost: 'ຕົ້ນທຶນເມນູ', salePrefix: 'ຮັບຊຳລະອໍເດີ #', costPrefix: 'ຕົ້ນທຶນອໍເດີ #'
    } : {
        headers: ['วันที่', 'ประเภท', 'ที่มา', 'หมวดหมู่', 'รายละเอียด', 'จำนวนเงิน (LAK)', 'ช่องทาง', 'เลขอ้างอิง', 'สถานะ', 'เหตุผลยกเลิก', 'รหัสรายการ', 'ต้นทุนครบถ้วน', 'การคิดกำไร', 'เลขบิล', 'โต๊ะ', 'ผู้บันทึก/รับชำระ', 'วันเวลาบันทึก', 'ปรับปรุงจาก', 'Currency', 'Original amount', 'Exchange rate to LAK'],
        kinds: { income: 'รายรับ', expense: 'รายจ่าย', cost: 'ต้นทุน' }, sources: { sale: 'ขาย', manual: 'บันทึกเอง', cost: 'ต้นทุน' }, methods: { cash: 'เงินสด', transfer: 'โอนเงิน', qr: 'ชำระ QR', card: 'บัตร', other: 'อื่น ๆ' }, treatments: { operating: 'ดำเนินงาน', inventory: 'สต็อก' }, active: 'ใช้งาน', void: 'ยกเลิกแล้ว', complete: 'ครบ', incomplete: 'ไม่ครบ', food: 'ยอดขายอาหาร', menuCost: 'ต้นทุนเมนู', salePrefix: 'รับชำระออเดอร์ #', costPrefix: 'ต้นทุนออเดอร์ #'
    };
    const map = (dict, value) => dict[value] ?? value;
    return [labels.headers, ...rows.map(row => [
            row.date, map(labels.kinds, row.kind), map(labels.sources, row.source), row.source === 'sale' ? labels.food : row.source === 'cost' ? labels.menuCost : row.category,
            row.source === 'sale' ? labels.salePrefix + String(row.id).slice(0, 8) : row.source === 'cost' ? labels.costPrefix + String(row.id).slice(0, 8) : row.description,
            row.amount, map(labels.methods, row.payment_method), row.reference, row.voided_at ? labels.void : labels.active, row.void_reason, row.id, row.cost_incomplete ? labels.incomplete : labels.complete, map(labels.treatments, row.treatment), row.bill_number, row.table_name, row.operator, row.created_at?.toISOString(), row.replaces_id, row.currency_code ?? 'LAK', row.currency_amount ?? row.amount, row.exchange_rate ?? 1
        ])];
}
export function createFinanceController(app, env) {
    const get_api_restaurants_restaurantId_finance = async (request, reply) => {
        const auth = await access(request, reply, env);
        if (!auth)
            return;
        const q = request.query;
        if (!range(q) || !timeRange(q))
            return bad(reply);
        const fromTime = q.fromTime ?? '00:00', toTime = q.toTime ?? '23:59';
        const page = Number(q.page ?? 1);
        const kind = q.kind ?? 'all';
        if (!Number.isSafeInteger(page) || page < 1 || page > 100000 || !['all', 'income', 'expense', 'cost'].includes(kind))
            return bad(reply);
        const args = [auth.restaurantId, q.from, q.to, fromTime, toTime];
        const result = await app.db.query(ledger + `
  select (select json_build_object(
   'sales',coalesce(sum(amount) filter(where source='sale' and voided_at is null),0)::text,
   'otherIncome',coalesce(sum(amount) filter(where source='manual' and kind='income' and voided_at is null),0)::text,
   'income',coalesce(sum(amount) filter(where kind='income' and voided_at is null),0)::text,
   'expense',coalesce(sum(amount) filter(where kind='expense' and treatment='operating' and voided_at is null),0)::text,
   'inventoryPurchases',coalesce(sum(amount) filter(where kind='expense' and treatment='inventory' and voided_at is null),0)::text,
   'cost',coalesce(sum(amount) filter(where kind='cost'),0)::text,
   'incompleteCostOrders',count(*) filter(where cost_incomplete),
   'possibleDuplicateCostExpenses',count(*) filter(where kind='expense' and treatment='operating' and voided_at is null and category in ('วัตถุดิบ','ต้นทุน','ต้นทุนวัตถุดิบ','ซื้อวัตถุดิบ')),
   'net',coalesce(sum(case when kind='income' then amount else -amount end) filter(where voided_at is null and treatment='operating'),0)::text
  ) from ledger) as summary,
  (select coalesce(json_agg(c),'[]') from (
   select category,kind,sum(amount)::text as amount from ledger
   where source='manual' and voided_at is null and treatment='operating'
   group by category,kind order by kind,category
  ) c) as categories,
  (select coalesce(json_agg(d),'[]') from (select entry_date::text as date,
   coalesce(sum(amount) filter(where kind='income'),0)::text as income,
   coalesce(sum(amount) filter(where kind='expense' and treatment='operating'),0)::text as expense,
   coalesce(sum(amount) filter(where kind='cost'),0)::text as cost
   from ledger where voided_at is null group by entry_date order by entry_date) d) as daily,
  (select count(*)::int from ledger where ($6='all' or kind=$6)) as count,
  (select coalesce(json_agg(r),'[]') from (select *,entry_date::text as date,
   case when source in ('sale','cost') then (select receipt_number from orders where id=ledger.id) else reference end as bill_number,
   case when source in ('sale','cost') then (select t.table_number from orders o join tables t on t.id=o.table_id where o.id=ledger.id) end as table_name,
   case when source in ('sale','cost') then (select receipt_user from orders where id=ledger.id) else (select coalesce(u.display_name,u.email) from finance_entries f left join app_users u on u.id=f.created_by where f.id=ledger.id) end as operator,
   (select receipt_id from finance_entries f where source='manual' and f.id=ledger.id) as receipt_id,
   (select replaces_id from finance_entries f where source='manual' and f.id=ledger.id) as replaces_id
   from ledger
   where ($6='all' or kind=$6) order by entry_date desc,created_at desc,id desc,source desc limit 50 offset $7) r) as entries`, [...args, kind, (page - 1) * 50]);
        return { ok: true, ...result.rows[0], page, pageSize: 50 };
    };
    const get_api_restaurants_restaurantId_finance_export = async (request, reply) => {
        const auth = await access(request, reply, env);
        if (!auth)
            return;
        if (!range(request.query) || !timeRange(request.query))
            return bad(reply);
        const { from, to } = request.query, fromTime = request.query.fromTime ?? '00:00', toTime = request.query.toTime ?? '23:59';
        const result = await app.db.query(ledger + ` select *,entry_date::text as date,
   case when source in ('sale','cost') then (select receipt_number from orders where id=ledger.id) else reference end bill_number,
   case when source in ('sale','cost') then (select t.table_number from orders o join tables t on t.id=o.table_id where o.id=ledger.id) end table_name,
   case when source in ('sale','cost') then (select receipt_user from orders where id=ledger.id) else (select coalesce(u.display_name,u.email) from finance_entries f left join app_users u on u.id=f.created_by where f.id=ledger.id) end operator,
   (select replaces_id from finance_entries f where source='manual' and f.id=ledger.id) replaces_id
   from ledger order by entry_date desc,created_at desc,id desc,source desc`, [auth.restaurantId, from, to, fromTime, toTime]);
        const locale = request.query.locale === "en" || request.query.locale === "lo" ? request.query.locale : "th";
        const lines = financeCsvRows(result.rows, locale);
        const csv = '\ufeff' + lines.map(row => row.map(csvCell).join(',')).join('\r\n');
        if (request.query.format === 'json')
            return { ok: true, csv };
        return reply.header('Content-Type', 'text/csv; charset=utf-8').header('Content-Disposition', `attachment; filename="shopqr-finance-${from}-${to}.csv"`).send(csv);
    };
    const post_api_restaurants_restaurantId_finance_entries = async (request, reply) => {
        const auth = await access(request, reply, env);
        if (!auth)
            return;
        const b = request.body ?? {};
        const currencyCode = b.currencyCode ?? 'LAK', exchangeRate = b.exchangeRate ?? '1';
        const baseCurrency = (await app.db.query('select currency_code from restaurants where id=$1', [auth.restaurantId])).rows[0]?.currency_code ?? 'LAK';
        if (!['income', 'expense'].includes(b.kind) || !date(b.date) || !uuid(b.requestId) ||
            typeof b.amount !== 'string' || !/^\d{1,12}(\.\d{1,2})?$/.test(b.amount) || Number(b.amount) <= 0 ||
            !currencyCodes.includes(currencyCode) || !validExchangeRate(exchangeRate) || (currencyCode === baseCurrency && Number(exchangeRate) !== 1) || Number(b.amount) * Number(exchangeRate) > 999999999999.99 ||
            !clean(b.category, 100, true) || !clean(b.description, 500, true) || !clean(b.reference ?? '', 100) ||
            !['cash', 'transfer', 'qr', 'card', 'other'].includes(b.paymentMethod) ||
            !['operating', 'inventory'].includes(b.treatment ?? 'operating') || (b.kind === 'income' && b.treatment === 'inventory') ||
            (b.receiptId && !uuid(b.receiptId)) || (b.replacesId && !uuid(b.replacesId)))
            return bad(reply);
        if (b.receiptId && !(await app.db.query('select 1 from finance_receipts where id=$1 and restaurant_id=$2', [b.receiptId, auth.restaurantId])).rowCount)
            return bad(reply);
        if (b.replacesId && !(await app.db.query('select 1 from finance_entries where id=$1 and restaurant_id=$2 and voided_at is not null', [b.replacesId, auth.restaurantId])).rowCount)
            return bad(reply);
        const values = [auth.restaurantId, b.kind, b.amount, exchangeRate, b.date, b.category.trim(), b.description.trim(), b.paymentMethod, (b.reference ?? '').trim(), auth.user.id, b.requestId, b.treatment ?? 'operating', b.receiptId || null, b.replacesId || null, currencyCode];
        const result = await app.db.query(`insert into finance_entries(restaurant_id,kind,amount,entry_date,category,description,payment_method,reference,created_by,request_id,treatment,receipt_id,replaces_id,currency_code,currency_amount,exchange_rate)
   values($1,$2,round($3::numeric*$4::numeric,2),$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$3,$4) on conflict(restaurant_id,request_id) do nothing returning *`, values);
        if (result.rows[0])
            return reply.code(201).send({ ok: true, entry: result.rows[0] });
        const previous = (await app.db.query(`select * from finance_entries where restaurant_id=$1 and request_id=$2`, [auth.restaurantId, b.requestId])).rows[0];
        // A retry may reuse its key only for the same payment details.
        if (!previous || previous.kind !== b.kind || Number(previous.currency_amount) !== Number(b.amount) || previous.currency_code !== currencyCode || Number(previous.exchange_rate) !== Number(exchangeRate) ||
            dayString(previous.entry_date) !== b.date || previous.category !== b.category.trim() || previous.description !== b.description.trim() || previous.payment_method !== b.paymentMethod || previous.reference !== (b.reference ?? '').trim() || previous.treatment !== (b.treatment ?? 'operating') || previous.receipt_id !== (b.receiptId || null) || previous.replaces_id !== (b.replacesId || null))
            return reply.code(409).send({ ok: false, error: 'FINANCE_REQUEST_CONFLICT' });
        return { ok: true, entry: previous };
    };
    const post_api_restaurants_restaurantId_finance_entries_entryId_void = async (request, reply) => {
        const auth = await access(request, reply, env);
        if (!auth)
            return;
        if (!uuid(request.params.entryId) || !clean(request.body?.reason, 500, true))
            return bad(reply);
        const result = await app.db.query(`update finance_entries set voided_at=now(),voided_by=$3,void_reason=$4
   where restaurant_id=$1 and id=$2 and voided_at is null returning *`, [auth.restaurantId, request.params.entryId, auth.user.id, request.body.reason.trim()]);
        if (!result.rows[0])
            return reply.code(409).send({ ok: false, error: 'FINANCE_ENTRY_NOT_ACTIVE' });
        return { ok: true, entry: result.rows[0] };
    };
    return { get_api_restaurants_restaurantId_finance, get_api_restaurants_restaurantId_finance_export, post_api_restaurants_restaurantId_finance_entries, post_api_restaurants_restaurantId_finance_entries_entryId_void };
}
function dayString(value) { return typeof value === 'string' ? value.slice(0, 10) : `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`; }
