alter table app_admins
  add column if not exists section_permissions jsonb,
  add constraint app_admins_section_permissions_object
    check (section_permissions is null or jsonb_typeof(section_permissions) = 'object');
