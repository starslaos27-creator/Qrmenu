create table if not exists pro_payment_settings (
  id boolean primary key default true check (id),
  qr_url text not null,
  updated_by uuid references app_users(id),
  updated_at timestamptz not null default now()
);

create table if not exists pro_payment_slips (
  pro_request_id uuid primary key references pro_requests(id),
  content_type text not null check (content_type in ('image/jpeg', 'image/png', 'image/webp')),
  image_data bytea not null,
  created_at timestamptz not null default now()
);

create table if not exists hidden_bills (
  restaurant_id uuid not null references restaurants(id),
  receipt_number text not null,
  hidden_by uuid not null references app_users(id),
  hidden_at timestamptz not null default now(),
  primary key (restaurant_id, receipt_number)
);
