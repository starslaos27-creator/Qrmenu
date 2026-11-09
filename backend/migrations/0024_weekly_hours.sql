alter table restaurants add column weekly_hours jsonb,
  add column weekly_hours_version integer not null default 0;
alter table restaurants add constraint weekly_hours_object check(weekly_hours is null or jsonb_typeof(weekly_hours)='object');
