alter table tables
  add column if not exists bill_check_requested_at timestamptz,
  add column if not exists bill_check_requested_by uuid references app_users(id) on delete set null;
