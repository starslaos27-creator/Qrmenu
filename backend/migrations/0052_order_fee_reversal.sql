alter table order_fee_requests drop constraint order_fee_requests_status_check;
alter table order_fee_requests add constraint order_fee_requests_status_check
  check (status in ('pending','approved','rejected','reversed'));
