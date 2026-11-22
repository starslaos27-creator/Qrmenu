create table if not exists platform_contact_messages (
  id bigint generated always as identity primary key,
  name text not null,
  email text not null,
  subject text not null,
  message text not null,
  created_at timestamptz not null default now()
);
create index if not exists platform_contact_messages_created_idx on platform_contact_messages (created_at desc, id desc);
