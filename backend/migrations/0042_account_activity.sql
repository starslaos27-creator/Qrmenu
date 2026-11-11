-- Track current account presence and inactivity independently from profile edits.
alter table app_users
  add column if not exists last_activity_at timestamptz;

-- Existing installations have no reliable historical activity timestamp. Give
-- current accounts a fresh baseline so the first sweep cannot suspend them
-- based only on account age.
update app_users
set last_activity_at = now()
where last_activity_at is null;

alter table app_users
  alter column last_activity_at set default now(),
  alter column last_activity_at set not null;

create index if not exists app_users_last_activity_idx
  on app_users (last_activity_at);
