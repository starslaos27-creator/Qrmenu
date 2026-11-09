-- Cross-tenant integrity and API idempotency.

alter table tables
  add constraint tables_id_restaurant_unique unique (id, restaurant_id);

alter table menus
  add constraint menus_id_restaurant_unique unique (id, restaurant_id);

alter table orders
  add column if not exists client_request_id text,
  add column if not exists stock_applied_at timestamptz,
  add column if not exists stock_reversed_at timestamptz;

create unique index if not exists orders_client_request_unique_idx
  on orders(restaurant_id, client_request_id)
  where client_request_id is not null;

alter table orders
  add constraint orders_table_restaurant_fk
  foreign key (table_id, restaurant_id)
  references tables(id, restaurant_id)
  on delete restrict;

alter table call_staff_requests
  add constraint call_staff_table_restaurant_fk
  foreign key (table_id, restaurant_id)
  references tables(id, restaurant_id)
  on delete cascade;

create index if not exists call_staff_table_created_idx
  on call_staff_requests(table_id, created_at desc);

