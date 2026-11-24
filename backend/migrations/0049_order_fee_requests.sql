create table order_fee_requests (
  id uuid primary key default gen_random_uuid(),
  request_key uuid not null unique,
  restaurant_id uuid not null references restaurants(id),
  requested_by uuid not null references app_users(id),
  month_start date not null check (extract(day from month_start) = 1),
  bill_count integer not null check (bill_count > 0),
  fee_lak numeric(16,2) not null check (fee_lak > 0),
  rate_lak numeric(16,2) not null check (rate_lak > 0),
  amount_usd numeric(16,2) not null check (amount_usd > 0),
  bill_fingerprint text not null,
  slip_type text not null check (slip_type in ('image/jpeg','image/png','image/webp')),
  slip_data bytea not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references app_users(id),
  review_note text not null default '' check (length(review_note) <= 1000),
  check ((status='pending' and reviewed_at is null and reviewed_by is null) or (status<>'pending' and reviewed_at is not null and reviewed_by is not null))
);
create unique index order_fee_one_current_request on order_fee_requests(restaurant_id,month_start) where status in ('pending','approved');
create index order_fee_admin_status on order_fee_requests(status,created_at desc);
