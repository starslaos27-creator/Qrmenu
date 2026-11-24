alter table restaurants
  add column if not exists restaurant_type text,
  add column if not exists description text;
