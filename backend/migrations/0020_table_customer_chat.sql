create table if not exists table_chat_messages (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  table_id uuid not null references tables(id) on delete cascade,
  sender text not null check (sender in ('customer', 'staff')),
  sender_user_id uuid references app_users(id) on delete set null,
  message text not null check (char_length(message) between 1 and 1000),
  read_by_staff boolean not null default false,
  read_by_customer boolean not null default false,
  created_at timestamptz not null default now(),
  constraint table_chat_table_restaurant_fk
    foreign key (table_id, restaurant_id)
    references tables(id, restaurant_id)
    on delete cascade
);

create index if not exists table_chat_restaurant_created_idx
  on table_chat_messages(restaurant_id, created_at desc);
create index if not exists table_chat_table_created_idx
  on table_chat_messages(table_id, created_at);
create index if not exists table_chat_staff_unread_idx
  on table_chat_messages(restaurant_id, read_by_staff, created_at desc)
  where sender = 'customer';
create index if not exists table_chat_customer_unread_idx
  on table_chat_messages(table_id, read_by_customer, created_at desc)
  where sender = 'staff';
