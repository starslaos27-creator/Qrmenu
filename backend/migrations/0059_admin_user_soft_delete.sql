alter table app_users
  add column if not exists deleted_at timestamptz,
  add column if not exists deletion_reason text;

create index if not exists app_users_not_deleted_idx
  on app_users (created_at desc)
  where deleted_at is null;
