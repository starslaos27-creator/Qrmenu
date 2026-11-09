create table finance_entries (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  kind text not null check (kind in ('income','expense')),
  amount numeric(16,2) not null check (amount > 0 and amount <= 999999999999.99),
  entry_date date not null,
  category text not null check (length(category) between 1 and 100),
  description text not null check (length(description) between 1 and 500),
  payment_method text not null check (payment_method in ('cash','transfer','other')),
  reference text not null default '' check (length(reference) <= 100),
  created_by uuid references app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  request_id uuid not null,
  voided_at timestamptz,
  voided_by uuid references app_users(id) on delete set null,
  void_reason text check (length(void_reason) between 1 and 500),
  unique (restaurant_id, request_id),
  check ((voided_at is null and void_reason is null) or (voided_at is not null and void_reason is not null))
);
create index finance_entries_restaurant_date_idx on finance_entries(restaurant_id, entry_date desc, created_at desc);
create index orders_finance_paid_idx on orders(restaurant_id, paid_at) where paid = true;
