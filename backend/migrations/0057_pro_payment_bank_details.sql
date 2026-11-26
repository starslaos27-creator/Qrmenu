create table if not exists pro_payment_bank_details (
  id boolean primary key default true check (id),
  bank_name text not null,
  account_number text not null,
  account_name text not null,
  updated_by uuid references app_users(id),
  updated_at timestamptz not null default now()
);

insert into pro_payment_bank_details(id, bank_name, account_number, account_name)
values (true, 'ธนาคารการค้าต่างประเทศลาว', '010120100057276001', 'Sonesay CHANGPACHENG')
on conflict (id) do nothing;
