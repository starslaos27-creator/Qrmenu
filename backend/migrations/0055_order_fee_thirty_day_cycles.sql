alter table order_fee_requests
  drop constraint if exists order_fee_requests_month_start_check,
  add column cycle_start_at timestamptz,
  add column cycle_cutoff_at timestamptz;

update order_fee_requests
set cycle_start_at = month_start::timestamp at time zone 'Asia/Vientiane',
    cycle_cutoff_at = ((period_end + 1)::date + time '06:00') at time zone 'Asia/Vientiane'
where cycle_start_at is null or cycle_cutoff_at is null;

alter table order_fee_requests
  alter column cycle_start_at set not null,
  alter column cycle_cutoff_at set not null;

drop index if exists order_fee_one_pending_month;
drop index if exists order_fee_one_current_request;
create unique index order_fee_one_cycle
  on order_fee_requests(restaurant_id, cycle_start_at)
  where status in ('pending','approved') and not is_test;
