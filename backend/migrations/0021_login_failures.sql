create table if not exists app_login_failures (
  identifier_hash text primary key,
  user_id uuid references app_users(id) on delete set null,
  failed_count bigint not null default 0 check (failed_count >= 0),
  first_failed_at timestamptz not null default now(),
  last_failed_at timestamptz not null default now()
);

create index if not exists app_login_failures_user_id_idx
  on app_login_failures(user_id)
  where user_id is not null;
