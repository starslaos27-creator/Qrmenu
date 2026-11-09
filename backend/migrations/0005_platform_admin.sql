-- Platform administration and accountable account recovery.

alter table app_users
  add column if not exists password_migrated_at timestamptz,
  add column if not exists last_login_at timestamptz,
  add column if not exists disabled_reason text;

update app_users
set password_migrated_at = coalesce(updated_at, created_at, now())
where password_hash is not null and password_migrated_at is null;

alter table restaurants
  add column if not exists suspended_at timestamptz,
  add column if not exists suspension_reason text;

alter table app_admins
  add column if not exists role text not null default 'support',
  add column if not exists active boolean not null default true,
  add column if not exists created_by uuid references app_users(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now(),
  add constraint app_admins_role_valid
    check (role in ('super_admin', 'support', 'viewer'));

create table if not exists platform_admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references app_users(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid,
  restaurant_id uuid references restaurants(id) on delete set null,
  reason text,
  details jsonb not null default '{}'::jsonb,
  ip_address inet,
  created_at timestamptz not null default now(),
  constraint platform_admin_audit_details_object
    check (jsonb_typeof(details) = 'object')
);
create index if not exists platform_admin_audit_created_idx
  on platform_admin_audit_logs(created_at desc);
create index if not exists platform_admin_audit_target_idx
  on platform_admin_audit_logs(target_type, target_id, created_at desc);
create index if not exists platform_admin_audit_restaurant_idx
  on platform_admin_audit_logs(restaurant_id, created_at desc);

alter table password_reset_tokens
  add column if not exists created_by_admin uuid references app_users(id) on delete set null,
  add column if not exists requested_reason text;

