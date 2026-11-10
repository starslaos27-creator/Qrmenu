create table restaurant_pro_trials (
  restaurant_id uuid primary key references restaurants(id) on delete cascade,
  starts_at timestamptz not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (expires_at > starts_at)
);
