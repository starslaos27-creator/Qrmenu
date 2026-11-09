create table pro_pricing (
  id boolean primary key default true check (id),
  monthly_usd numeric(12,2) check (monthly_usd > 0 and monthly_usd <= 1000000),
  version integer not null default 1,
  updated_by uuid references app_users(id),
  updated_at timestamptz not null default now()
);
-- Preserve the most recently recorded price, if one already exists.
insert into pro_pricing(id,monthly_usd)
values (true,(select monthly_usd from pro_requests order by created_at desc,id desc limit 1));
