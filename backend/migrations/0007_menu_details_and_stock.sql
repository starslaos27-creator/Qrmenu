-- Extra data collected when a menu item is created from the manager menu form.
-- These columns keep the menu's commercial and stock-form details available
-- to the manager menu API.
alter table menus
  add column if not exists cost_price numeric(12, 2) not null default 0
    check (cost_price >= 0),
  add column if not exists description text,
  add column if not exists track_stock boolean not null default false,
  add column if not exists stock_quantity numeric(14, 3) not null default 0
    check (stock_quantity >= 0),
  add column if not exists stock_barcode text,
  add column if not exists low_alert_limit numeric(14, 3) not null default 0
    check (low_alert_limit >= 0);
