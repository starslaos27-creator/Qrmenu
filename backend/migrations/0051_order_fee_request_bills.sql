create table order_fee_request_bills (
  request_id uuid not null references order_fee_requests(id) on delete cascade,
  bill_id uuid not null references bill_payment_details(id),
  primary key (request_id,bill_id)
);
create index order_fee_request_bills_bill on order_fee_request_bills(bill_id);

-- Link earlier requests only when their original snapshot still matches.
with matched as (
  select r.id from order_fee_requests r
  left join bill_payment_details b on b.restaurant_id=r.restaurant_id and b.reopened_at is null
    and b.paid_at >= (r.month_start::timestamp at time zone 'Asia/Vientiane')
    and b.paid_at < ((r.period_end + 1)::timestamp at time zone 'Asia/Vientiane')
  group by r.id,r.bill_fingerprint
  having md5(coalesce(string_agg(b.id::text || ':' || b.bill_total::text || ':' || extract(epoch from b.paid_at)::text, ',' order by b.id),''))=r.bill_fingerprint
)
insert into order_fee_request_bills(request_id,bill_id)
select r.id,b.id from order_fee_requests r join matched m on m.id=r.id
join bill_payment_details b on b.restaurant_id=r.restaurant_id and b.reopened_at is null
  and b.paid_at >= (r.month_start::timestamp at time zone 'Asia/Vientiane')
  and b.paid_at < ((r.period_end + 1)::timestamp at time zone 'Asia/Vientiane');

do $$
begin
  if exists (
    select 1 from order_fee_requests r
    where r.status in ('pending','approved')
      and r.bill_count <> (select count(*) from order_fee_request_bills l where l.request_id=r.id)
  ) then
    raise exception 'Existing order fee requests no longer match their bills; reconcile them before migration';
  end if;
end $$;

drop index order_fee_one_current_request;
create unique index order_fee_one_pending_month on order_fee_requests(restaurant_id,month_start)
  where status='pending' and not is_test;
