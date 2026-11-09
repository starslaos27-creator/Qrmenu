create table if not exists auth_refresh_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  token_hash bytea not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  replaced_by uuid references auth_refresh_sessions(id) on delete set null,
  user_agent text,
  ip_address inet,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index if not exists auth_refresh_sessions_user_idx
  on auth_refresh_sessions(user_id, expires_at desc);
create index if not exists auth_refresh_sessions_active_idx
  on auth_refresh_sessions(expires_at)
  where revoked_at is null;

create table if not exists password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  token_hash bytea not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists password_reset_tokens_user_idx
  on password_reset_tokens(user_id, created_at desc);
create index if not exists password_reset_tokens_active_idx
  on password_reset_tokens(expires_at)
  where used_at is null;

