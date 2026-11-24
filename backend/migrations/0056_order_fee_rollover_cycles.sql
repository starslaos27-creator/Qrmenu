drop index if exists order_fee_one_cycle;
drop index if exists order_fee_one_pending_month;
drop index if exists order_fee_one_current_request;

create unique index order_fee_one_cycle_cutoff
  on order_fee_requests(restaurant_id, cycle_cutoff_at)
  where status in ('pending','approved') and not is_test;
