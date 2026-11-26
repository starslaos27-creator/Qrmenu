alter table restaurant_members
  add column if not exists page_permissions jsonb,
  add constraint restaurant_members_page_permissions_object
    check (page_permissions is null or jsonb_typeof(page_permissions) = 'object');
