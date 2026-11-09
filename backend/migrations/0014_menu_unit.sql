alter table menus add column if not exists unit text;
alter table menus add constraint menus_unit_length check (unit is null or (length(trim(unit)) between 1 and 40));
