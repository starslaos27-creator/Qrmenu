alter table stock_deposits
  add column if not exists inventory_item_id uuid references inventory_items(id) on delete set null,
  add column if not exists expiry_resolution text check (expiry_resolution in ('added_to_stock', 'discarded')),
  add column if not exists expiry_resolved_by uuid references app_users(id) on delete set null,
  add column if not exists expiry_resolved_at timestamptz;

create index if not exists stock_deposits_inventory_item_idx
  on stock_deposits (restaurant_id, inventory_item_id)
  where inventory_item_id is not null;
