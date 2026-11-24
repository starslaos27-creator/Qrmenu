alter table order_fee_requests add column is_test boolean not null default false;
alter table order_fee_requests add column period_end date;
update order_fee_requests set period_end=(month_start + interval '1 month - 1 day')::date;
alter table order_fee_requests alter column period_end set not null;
drop index order_fee_one_current_request;
create unique index order_fee_one_current_request on order_fee_requests(restaurant_id,month_start) where status in ('pending','approved') and not is_test;
