alter table bill_payment_details
  add column reopened_at timestamptz,
  add column reopened_by uuid references app_users(id) on delete set null;

create index if not exists bill_payment_details_reopened_idx
  on bill_payment_details(restaurant_id, reopened_at desc)
  where reopened_at is not null;
