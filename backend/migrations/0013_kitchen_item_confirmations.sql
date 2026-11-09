alter table orders add column if not exists item_confirmations jsonb not null default '{}'::jsonb;
