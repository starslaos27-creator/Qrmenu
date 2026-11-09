-- Restore the stock-deposits feature after its removal migration.
-- Deposit rows were already removed by 0035; this starts with an empty table.
create table if not exists stock_deposits (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  customer_name text not null,
  customer_contact text,
  product_name text not null,
  quantity numeric(14,3) not null check (quantity > 0),
  unit text not null,
  due_date date not null,
  note text,
  status text not null default 'pending' check (status in ('pending', 'picked_up', 'expired')),
  created_by uuid references app_users(id) on delete set null,
  picked_up_by uuid references app_users(id) on delete set null,
  picked_up_at timestamptz,
  expired_at timestamptz,
  inventory_item_id uuid references inventory_items(id) on delete set null,
  expiry_resolution text check (expiry_resolution in ('added_to_stock', 'discarded')),
  expiry_resolved_by uuid references app_users(id) on delete set null,
  expiry_resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status <> 'picked_up') or picked_up_at is not null),
  check ((status <> 'expired') or expired_at is not null)
);

create index if not exists stock_deposits_restaurant_status_due_idx
  on stock_deposits (restaurant_id, status, due_date, created_at desc);

create index if not exists stock_deposits_inventory_item_idx
  on stock_deposits (restaurant_id, inventory_item_id)
  where inventory_item_id is not null;
