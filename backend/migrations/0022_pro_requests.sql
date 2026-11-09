-- Approval/history only: no charges, payment verification or entitlement changes.
create table pro_requests (
  id uuid primary key default gen_random_uuid(),
  request_key uuid not null unique,
  restaurant_id uuid not null references restaurants(id),
  requested_by uuid not null references app_users(id),
  paid_months integer not null check (paid_months in (1,3,6,9,12)),
  free_months integer not null,
  monthly_usd numeric(12,2) not null check (monthly_usd > 0 and monthly_usd <= 1000000),
  total_usd numeric(14,2) not null,
  currency text not null default 'USD' check (currency = 'USD'),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  reviewed_by uuid references app_users(id),
  reviewed_at timestamptz,
  review_note text not null default '' check (length(review_note) <= 1000),
  check (free_months = case when paid_months = 12 then 2 when paid_months in (6,9) then 1 else 0 end),
  check (total_usd = monthly_usd * paid_months),
  check ((status = 'pending' and reviewed_by is null and reviewed_at is null)
      or (status <> 'pending' and reviewed_by is not null and reviewed_at is not null))
);
create unique index pro_requests_one_pending on pro_requests(restaurant_id) where status = 'pending';
create index pro_requests_history on pro_requests(restaurant_id, created_at desc);
create index pro_requests_admin on pro_requests(status, created_at desc);
