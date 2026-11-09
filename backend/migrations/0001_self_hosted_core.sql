-- ShopQR self-hosted PostgreSQL foundation.
-- This schema intentionally keeps the existing Supabase table/column names
-- where practical so data can be migrated without rewriting image URLs.

create extension if not exists pgcrypto;

do $$ begin
  create type order_status as enum ('pending', 'ready', 'served', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type restaurant_role as enum ('owner', 'staff', 'cook', 'waiter');
exception when duplicate_object then null; end $$;

do $$ begin
  create type stock_movement_type as enum (
    'opening',
    'purchase',
    'sale',
    'waste',
    'adjustment',
    'transfer_in',
    'transfer_out',
    'return_in',
    'return_out',
    'recipe_consumption'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type purchase_order_status as enum ('draft', 'ordered', 'partially_received', 'received', 'cancelled');
exception when duplicate_object then null; end $$;

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  password_hash text,
  phone text,
  phone_normalized text,
  display_name text,
  email_verified_at timestamptz,
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_users_email_not_blank check (btrim(email) <> '')
);
create unique index if not exists app_users_email_unique_idx on app_users (lower(email));
create unique index if not exists app_users_phone_unique_idx
  on app_users (phone_normalized) where phone_normalized is not null;

create table if not exists restaurants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete restrict,
  name text not null,
  accepting_orders boolean not null default true,
  open_time text,
  close_time text,
  service_charge_pct numeric(5, 2) not null default 0
    check (service_charge_pct between 0 and 100),
  vat_pct numeric(5, 2) not null default 0
    check (vat_pct between 0 and 100),
  payment_qr_url text,
  kitchen_print_width int not null default 58
    check (kitchen_print_width in (58, 76, 80)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists restaurants_user_id_idx on restaurants(user_id);

create table if not exists restaurant_members (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  user_id uuid not null references app_users(id) on delete cascade,
  role restaurant_role not null default 'staff',
  invited_email text,
  phone text,
  created_at timestamptz not null default now(),
  unique (restaurant_id, user_id)
);
create index if not exists restaurant_members_user_idx on restaurant_members(user_id);
create index if not exists restaurant_members_restaurant_idx on restaurant_members(restaurant_id);

create table if not exists app_admins (
  user_id uuid primary key references app_users(id) on delete cascade,
  added_at timestamptz not null default now()
);

create table if not exists table_zones (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (restaurant_id, name)
);
create index if not exists table_zones_restaurant_idx
  on table_zones(restaurant_id, sort_order, name);

create or replace function generate_table_short_code()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  code text;
begin
  loop
    code := upper(substr(encode(gen_random_bytes(5), 'hex'), 1, 8));
    exit when not exists (select 1 from tables where short_code = code);
  end loop;
  return code;
end;
$$;

create table if not exists tables (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  zone_id uuid not null references table_zones(id) on delete restrict,
  table_number int not null check (table_number > 0),
  qr_url text,
  short_code text not null default generate_table_short_code(),
  is_open boolean not null default false,
  created_at timestamptz not null default now(),
  unique (restaurant_id, zone_id, table_number),
  unique (short_code)
);
create index if not exists tables_restaurant_id_idx on tables(restaurant_id);
create index if not exists tables_zone_id_idx on tables(zone_id);
create index if not exists tables_is_open_idx on tables(restaurant_id, is_open);
create index if not exists tables_restaurant_short_code_idx on tables(restaurant_id, short_code);

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  name text not null,
  name_lo text,
  name_en text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists categories_restaurant_id_idx on categories(restaurant_id);
create index if not exists categories_sort_idx on categories(restaurant_id, sort_order);

create table if not exists menus (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  category_id uuid references categories(id) on delete set null,
  name text not null,
  name_lo text,
  name_en text,
  price numeric(12, 2) not null check (price >= 0),
  image_url text,
  available boolean not null default true,
  bundles jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint menus_bundles_array check (jsonb_typeof(bundles) = 'array')
);
create index if not exists menus_restaurant_id_idx on menus(restaurant_id);
create index if not exists menus_category_id_idx on menus(category_id);
create index if not exists menus_restaurant_available_created_idx
  on menus(restaurant_id, available, created_at desc);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references tables(id) on delete restrict,
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  items jsonb not null,
  status order_status not null default 'pending',
  total numeric(12, 2) not null default 0 check (total >= 0),
  paid boolean not null default false,
  paid_at timestamptz,
  payment_method text,
  cancel_reason text,
  accepted_at timestamptz,
  accepted_by uuid references app_users(id) on delete set null,
  completed_at timestamptz,
  completed_by uuid references app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint orders_items_array check (jsonb_typeof(items) = 'array'),
  constraint orders_paid_consistency check (not paid or paid_at is not null)
);
create index if not exists orders_restaurant_id_idx on orders(restaurant_id);
create index if not exists orders_table_id_idx on orders(table_id);
create index if not exists orders_status_idx on orders(status);
create index if not exists orders_completed_at_idx on orders(restaurant_id, completed_at desc);
create index if not exists orders_table_open_created_idx
  on orders(restaurant_id, table_id, paid, created_at);
create index if not exists orders_restaurant_status_created_idx
  on orders(restaurant_id, status, created_at);
create index if not exists orders_restaurant_paid_status_created_idx
  on orders(restaurant_id, paid, status, created_at);
create index if not exists orders_restaurant_paid_paid_at_idx
  on orders(restaurant_id, paid, paid_at desc);

create table if not exists call_staff_requests (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  table_id uuid not null references tables(id) on delete cascade,
  reason text,
  acknowledged boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists call_staff_restaurant_idx on call_staff_requests(restaurant_id);
create index if not exists call_staff_pending_created_idx
  on call_staff_requests(restaurant_id, acknowledged, created_at);

create table if not exists promotions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  title text not null,
  description text,
  image_url text,
  active boolean not null default true,
  sort_order int not null default 0,
  start_at timestamptz,
  end_at timestamptz,
  created_at timestamptz not null default now(),
  constraint promotions_schedule_valid check (end_at is null or start_at is null or end_at > start_at)
);
create index if not exists promotions_restaurant_idx on promotions(restaurant_id);
create index if not exists promotions_active_sort_created_idx
  on promotions(restaurant_id, active, sort_order, created_at desc);
create index if not exists promotions_schedule_idx
  on promotions(restaurant_id, active, start_at, end_at);

create table if not exists restaurant_invites (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  token text not null unique,
  role restaurant_role not null,
  created_by uuid not null references app_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  used_by uuid references app_users(id) on delete set null,
  used_at timestamptz,
  revoked_at timestamptz,
  constraint restaurant_invites_non_owner check (role <> 'owner')
);
create index if not exists invites_restaurant_idx on restaurant_invites(restaurant_id);
create index if not exists invites_token_idx on restaurant_invites(token);

create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references app_users(id) on delete set null,
  restaurant_id uuid references restaurants(id) on delete set null,
  email text,
  category text not null default 'general',
  message text not null,
  resolved boolean not null default false,
  admin_reply text,
  replied_at timestamptz,
  created_at timestamptz not null default now(),
  constraint feedback_category_valid check (category in ('bug', 'feature', 'general', 'question'))
);
create index if not exists feedback_created_idx on feedback(created_at desc);
create index if not exists feedback_user_idx on feedback(user_id);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  actor_user_id uuid references app_users(id) on delete set null,
  action text not null,
  target_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint audit_logs_details_object check (jsonb_typeof(details) = 'object')
);
create index if not exists audit_logs_restaurant_idx
  on audit_logs (restaurant_id, created_at desc);
create index if not exists audit_logs_action_idx
  on audit_logs (restaurant_id, action, created_at desc);
create index if not exists audit_logs_target_idx on audit_logs (target_id);

-- Inventory master data
create table if not exists stock_locations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  name text not null,
  is_default boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (restaurant_id, name)
);
create unique index if not exists stock_locations_one_default_idx
  on stock_locations(restaurant_id) where is_default;

create table if not exists inventory_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  name text not null,
  sku text,
  barcode text,
  unit text not null default 'piece',
  minimum_stock numeric(14, 3) not null default 0 check (minimum_stock >= 0),
  track_stock boolean not null default true,
  allow_negative boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, sku),
  unique (restaurant_id, barcode)
);
create index if not exists inventory_items_restaurant_idx
  on inventory_items(restaurant_id, active, name);

create table if not exists inventory_balances (
  inventory_item_id uuid not null references inventory_items(id) on delete cascade,
  location_id uuid not null references stock_locations(id) on delete cascade,
  quantity numeric(14, 3) not null default 0,
  updated_at timestamptz not null default now(),
  primary key (inventory_item_id, location_id)
);

create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  address text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists suppliers_restaurant_idx on suppliers(restaurant_id, active, name);

create table if not exists purchase_orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  supplier_id uuid references suppliers(id) on delete set null,
  location_id uuid not null references stock_locations(id) on delete restrict,
  status purchase_order_status not null default 'draft',
  order_number text not null,
  ordered_at timestamptz,
  received_at timestamptz,
  notes text,
  created_by uuid references app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, order_number)
);
create index if not exists purchase_orders_restaurant_idx
  on purchase_orders(restaurant_id, status, created_at desc);

create table if not exists purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references purchase_orders(id) on delete cascade,
  inventory_item_id uuid not null references inventory_items(id) on delete restrict,
  ordered_quantity numeric(14, 3) not null check (ordered_quantity > 0),
  received_quantity numeric(14, 3) not null default 0 check (received_quantity >= 0),
  unit_cost numeric(14, 2) check (unit_cost is null or unit_cost >= 0),
  unique (purchase_order_id, inventory_item_id)
);

create table if not exists stock_movements (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  inventory_item_id uuid not null references inventory_items(id) on delete restrict,
  location_id uuid not null references stock_locations(id) on delete restrict,
  movement_type stock_movement_type not null,
  quantity_delta numeric(14, 3) not null check (quantity_delta <> 0),
  unit_cost numeric(14, 2) check (unit_cost is null or unit_cost >= 0),
  reference_type text,
  reference_id uuid,
  idempotency_key text,
  note text,
  actor_user_id uuid references app_users(id) on delete set null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists stock_movements_item_idx
  on stock_movements(restaurant_id, inventory_item_id, occurred_at desc);
create index if not exists stock_movements_reference_idx
  on stock_movements(reference_type, reference_id);
create unique index if not exists stock_movements_idempotency_idx
  on stock_movements(restaurant_id, idempotency_key)
  where idempotency_key is not null;

create table if not exists menu_inventory_components (
  menu_id uuid not null references menus(id) on delete cascade,
  inventory_item_id uuid not null references inventory_items(id) on delete restrict,
  quantity numeric(14, 3) not null check (quantity > 0),
  primary key (menu_id, inventory_item_id)
);

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists app_users_set_updated_at on app_users;
create trigger app_users_set_updated_at
before update on app_users
for each row execute function set_updated_at();

drop trigger if exists restaurants_set_updated_at on restaurants;
create trigger restaurants_set_updated_at
before update on restaurants
for each row execute function set_updated_at();

drop trigger if exists menus_set_updated_at on menus;
create trigger menus_set_updated_at
before update on menus
for each row execute function set_updated_at();

drop trigger if exists inventory_items_set_updated_at on inventory_items;
create trigger inventory_items_set_updated_at
before update on inventory_items
for each row execute function set_updated_at();

drop trigger if exists purchase_orders_set_updated_at on purchase_orders;
create trigger purchase_orders_set_updated_at
before update on purchase_orders
for each row execute function set_updated_at();

create or replace function apply_stock_movement()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  current_quantity numeric(14, 3);
  item_restaurant_id uuid;
  location_restaurant_id uuid;
  negative_allowed boolean;
begin
  select restaurant_id, allow_negative
    into item_restaurant_id, negative_allowed
  from inventory_items
  where id = new.inventory_item_id;

  select restaurant_id
    into location_restaurant_id
  from stock_locations
  where id = new.location_id;

  if item_restaurant_id is null or location_restaurant_id is null then
    raise exception 'INVENTORY_REFERENCE_NOT_FOUND';
  end if;
  if new.restaurant_id <> item_restaurant_id or new.restaurant_id <> location_restaurant_id then
    raise exception 'INVENTORY_RESTAURANT_MISMATCH';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(new.inventory_item_id::text || ':' || new.location_id::text, 0)
  );

  select quantity into current_quantity
  from inventory_balances
  where inventory_item_id = new.inventory_item_id
    and location_id = new.location_id;

  current_quantity := coalesce(current_quantity, 0);
  if not negative_allowed and current_quantity + new.quantity_delta < 0 then
    raise exception 'INSUFFICIENT_STOCK';
  end if;

  insert into inventory_balances (inventory_item_id, location_id, quantity)
  values (new.inventory_item_id, new.location_id, new.quantity_delta)
  on conflict (inventory_item_id, location_id)
  do update set
    quantity = inventory_balances.quantity + excluded.quantity,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists stock_movements_apply_balance on stock_movements;
create trigger stock_movements_apply_balance
before insert on stock_movements
for each row execute function apply_stock_movement();

create or replace function protect_stock_movement()
returns trigger
language plpgsql
as $$
begin
  raise exception 'STOCK_MOVEMENTS_ARE_IMMUTABLE';
end;
$$;

drop trigger if exists stock_movements_no_update on stock_movements;
create trigger stock_movements_no_update
before update or delete on stock_movements
for each row execute function protect_stock_movement();

