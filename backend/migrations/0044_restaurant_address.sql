alter table restaurants
  add column if not exists address_street text,
  add column if not exists address_village text,
  add column if not exists address_city text,
  add column if not exists address_province text;
