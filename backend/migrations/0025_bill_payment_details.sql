create table if not exists bill_payment_details (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  table_id uuid not null references tables(id) on delete restrict,
  receipt_number text not null,
  payment_method text not null check (payment_method in ('cash','transfer','promptpay','card','other')),
  bill_total numeric(16,2) not null check (bill_total >= 0),
  cash_received numeric(16,2),
  change_due numeric(16,2) not null default 0 check (change_due >= 0),
  paid_at timestamptz not null default now(),
  created_by uuid references app_users(id) on delete set null,
  unique (restaurant_id, receipt_number),
  check ((payment_method = 'cash' and cash_received is not null and cash_received >= bill_total and change_due = cash_received - bill_total)
      or (payment_method <> 'cash' and cash_received is null and change_due = 0))
);

create index if not exists bill_payment_details_restaurant_paid_idx
  on bill_payment_details(restaurant_id, paid_at desc);
