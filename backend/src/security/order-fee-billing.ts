const CYCLE_MS = 30 * 24 * 60 * 60 * 1000;
const LAOS_OFFSET_MS = 7 * 60 * 60 * 1000;
const GRACE_MS = 48 * 60 * 60 * 1000;

type Queryable = { query: (sql: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> };

function nextLaosSixAm(timestamp: number) {
  const local = new Date(timestamp + LAOS_OFFSET_MS);
  const localHour = local.getUTCHours();
  const isExactlySix = localHour === 6 && local.getUTCMinutes() === 0 && local.getUTCSeconds() === 0 && local.getUTCMilliseconds() === 0;
  const dayOffset = localHour < 6 || isExactlySix ? 0 : 1;
  return Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + dayOffset, 6) - LAOS_OFFSET_MS;
}

function cycleFor(anchorAt: number, cycleIndex: number) {
  const startAt = anchorAt + cycleIndex * CYCLE_MS;
  const endAt = startAt + CYCLE_MS;
  const cutoffAt = nextLaosSixAm(endAt);
  return { startAt: new Date(startAt).toISOString(), endAt: new Date(endAt).toISOString(), cutoffAt: new Date(cutoffAt).toISOString(), payBy: new Date(cutoffAt + GRACE_MS).toISOString() };
}

export async function getOrderFeeBillingState(db: Queryable, restaurantId: string, testMode: boolean, now = Date.now()) {
  const result = await db.query(`with anchor as (
    select min(paid_at) as first_bill_at
    from bill_payment_details
    where restaurant_id=$1 and reopened_at is null
  ), outstanding as (
    select b.id, b.paid_at, b.bill_total,
      case when b.bill_total < 50000 then 0 when b.bill_total < 100000 then 200
        when b.bill_total < 250000 then 300 when b.bill_total < 400000 then 400
        when b.bill_total < 1000000 then 500 when b.bill_total < 1500000 then 1000
        when b.bill_total < 2500000 then 1250 else 1450 end as fee
    from bill_payment_details b
    where b.restaurant_id=$1 and b.reopened_at is null
      and not exists(select 1 from order_fee_request_bills l join order_fee_requests f on f.id=l.request_id
        where l.bill_id=b.id and f.status='approved' and f.is_test=$2)
  ), totals as (
    select coalesce(sum(fee),0)::text as fee_lak, count(*)::int as bill_count from outstanding
  )
  select a.first_bill_at, totals.fee_lak as outstanding_fee_lak, totals.bill_count as outstanding_bill_count,
    (select exists(select 1 from order_fee_requests f where f.restaurant_id=$1 and f.status='pending' and f.is_test=$2)) as has_pending_request
  from anchor a cross join totals`, [restaurantId, testMode]);

  const row = result.rows[0] || {};
  const firstBillAt = row.first_bill_at ? Date.parse(String(row.first_bill_at)) : null;
  const indexNow = firstBillAt === null ? null : Math.max(0, Math.floor((now - firstBillAt) / CYCLE_MS));
  const currentCycle = firstBillAt === null || indexNow === null ? null : cycleFor(firstBillAt, indexNow);
  const dueCycleIndex = firstBillAt === null ? -1 : Math.floor((now - firstBillAt) / CYCLE_MS) - 1;
  const payableCycle = firstBillAt === null || dueCycleIndex < 0 ? null : cycleFor(firstBillAt, dueCycleIndex);
  let payableBillCount = 0;
  let payableFeeLak = "0";
  if (payableCycle) {
    const due = await db.query(`select count(*)::int as bill_count,
      coalesce(sum(case when b.bill_total < 50000 then 0 when b.bill_total < 100000 then 200
        when b.bill_total < 250000 then 300 when b.bill_total < 400000 then 400
        when b.bill_total < 1000000 then 500 when b.bill_total < 1500000 then 1000
        when b.bill_total < 2500000 then 1250 else 1450 end),0)::text as fee_lak
      from bill_payment_details b
      where b.restaurant_id=$1 and b.reopened_at is null and b.paid_at < $2::timestamptz
        and not exists(select 1 from order_fee_request_bills l join order_fee_requests f on f.id=l.request_id
          where l.bill_id=b.id and f.status='approved' and f.is_test=$3)`, [restaurantId, payableCycle.cutoffAt, testMode]);
    payableBillCount = Number(due.rows[0]?.bill_count || 0);
    payableFeeLak = String(due.rows[0]?.fee_lak || "0");
  }
  const overdue = Boolean(payableCycle && now > Date.parse(payableCycle.payBy) && !row.has_pending_request);

  return {
    firstBillAt: firstBillAt === null ? null : new Date(firstBillAt).toISOString(),
    currentCycle,
    payableCycle,
    payableBillCount,
    payableFeeLak,
    outstandingBillCount: Number(row.outstanding_bill_count || 0),
    outstandingFeeLak: String(row.outstanding_fee_lak || "0"),
    hasPendingRequest: Boolean(row.has_pending_request),
    overdue,
    restricted: overdue && Number(row.outstanding_fee_lak || 0) > 0,
  };
}

export function isOrderFeeRestrictedPath(path: string) {
  return /\/api\/restaurants\/[^/]+\/(?:inventory|stock-deposits|menu|menus|categories|tables|table-qr|qr|orders|bills|kitchen)(?:\/|\?|$)/i.test(path);
}
