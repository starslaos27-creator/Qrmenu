create table platform_finance_entries (
  id uuid primary key default gen_random_uuid(),
  request_key uuid not null unique,
  kind text not null check (kind in ('income', 'expense')),
  entry_date date not null,
  category text not null check (length(btrim(category)) between 1 and 100),
  description text not null check (length(btrim(description)) between 1 and 500),
  amount numeric(14,2) not null check (amount > 0),
  currency_code text not null check (currency_code in ('LAK', 'THB', 'USD')),
  payment_method text not null check (payment_method in ('cash', 'transfer', 'qr', 'card', 'other')),
  reference text not null default '' check (length(reference) <= 200),
  source text not null default 'manual' check (source in ('manual', 'pro_package')),
  restaurant_id uuid references restaurants(id) on delete set null,
  pro_request_id uuid unique references pro_requests(id),
  created_by uuid references app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid references app_users(id) on delete set null,
  void_reason text,
  check ((source = 'manual' and pro_request_id is null)
      or (source = 'pro_package' and pro_request_id is not null)),
  check ((voided_at is null and voided_by is null and void_reason is null)
      or (voided_at is not null and voided_by is not null and length(btrim(void_reason)) between 1 and 1000))
);

create index platform_finance_entries_period_idx
  on platform_finance_entries(kind, entry_date desc, created_at desc);
create index platform_finance_entries_currency_idx
  on platform_finance_entries(currency_code, entry_date desc);

insert into platform_finance_entries
  (request_key, kind, entry_date, category, description, amount, currency_code,
   payment_method, reference, source, restaurant_id, pro_request_id, created_by, created_at)
select gen_random_uuid(), 'income', (l.created_at at time zone 'Asia/Bangkok')::date,
       'แพ็กเกจ Pro',
       'แพ็กเกจ Pro · ' || p.paid_months || ' เดือน' ||
         case when p.free_months > 0 then ' แถม ' || p.free_months || ' เดือน' else '' end,
       (l.details->>'totalUsd')::numeric,
       case when l.details->>'currency' in ('LAK', 'THB', 'USD') then l.details->>'currency' else 'USD' end,
       case when l.details->>'paymentMethod' in ('cash', 'transfer', 'qr', 'card', 'other') then l.details->>'paymentMethod' else 'other' end,
       left(coalesce(l.details->>'paymentReference', ''), 200), 'pro_package',
       l.restaurant_id, p.id, l.admin_user_id, l.created_at
from platform_admin_audit_logs l
join pro_requests p on p.id = l.target_id
where l.action = 'pro_purchase.activated'
  and l.target_type = 'pro_request'
  and coalesce(l.details->>'totalUsd', '') ~ '^\d+(\.\d{1,2})?$'
on conflict (pro_request_id) do nothing;
