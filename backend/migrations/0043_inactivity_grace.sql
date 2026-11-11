-- Keep the account's recorded activity history while granting existing users
-- one year from rollout before automatic inactivity suspension can affect them.
alter table app_users
  add column if not exists inactivity_suspension_eligible_at timestamptz;

with migration_clock as (
  select applied_at
  from schema_migrations
  where name = '0042_account_activity.sql'
), legacy_activity as (
  select u.id,
         greatest(
           u.created_at,
           coalesce(u.last_login_at, u.created_at),
           coalesce((select max(coalesce(s.last_used_at, s.created_at))
                     from auth_refresh_sessions s where s.user_id = u.id), u.created_at)
         ) as last_seen
  from app_users u
)
update app_users u
set last_activity_at = a.last_seen,
    inactivity_suspension_eligible_at = coalesce(
      u.inactivity_suspension_eligible_at,
      (select applied_at from migration_clock) + interval '365 days'
    )
from legacy_activity a, migration_clock c
where u.id = a.id
  and u.inactivity_suspension_eligible_at is null
  and u.last_activity_at = c.applied_at;

-- Include any accounts created between migrations or rows that did not match
-- the initial baseline timestamp. New users become eligible from signup time.
update app_users
set inactivity_suspension_eligible_at = now()
where inactivity_suspension_eligible_at is null;

alter table app_users
  alter column inactivity_suspension_eligible_at set default now(),
  alter column inactivity_suspension_eligible_at set not null;
