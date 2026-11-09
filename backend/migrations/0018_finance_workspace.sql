alter table finance_entries drop constraint finance_entries_payment_method_check;
alter table finance_entries add constraint finance_entries_payment_method_check
 check(payment_method in ('cash','transfer','qr','card','other'));
alter table finance_entries add column treatment text not null default 'operating'
 check(treatment in ('operating','inventory'));
alter table finance_entries add column replaces_id uuid references finance_entries(id) on delete set null;
create table finance_receipts (
 id uuid primary key default gen_random_uuid(),
 restaurant_id uuid not null references restaurants(id) on delete cascade,
 filename text not null, mime text not null, body bytea not null,
 created_by uuid references app_users(id) on delete set null,
 created_at timestamptz not null default now(),
 check(octet_length(body) between 1 and 5242880)
);
alter table finance_entries add column receipt_id uuid references finance_receipts(id) on delete set null;
create table finance_settings (
 restaurant_id uuid primary key references restaurants(id) on delete cascade,
 config jsonb not null default '{}', updated_at timestamptz not null default now()
);
create table finance_accounts (
 restaurant_id uuid not null references restaurants(id) on delete cascade,
 method text not null check(method in ('cash','transfer','qr','card','other')),
 name text not null check(length(name) between 1 and 100),
 opening_date date not null, opening_balance numeric(16,2) not null,
 updated_by uuid references app_users(id) on delete set null,
 primary key(restaurant_id,method)
);
create table finance_closings (
 id uuid primary key default gen_random_uuid(),
 restaurant_id uuid not null references restaurants(id) on delete cascade,
 close_date date not null, snapshot jsonb not null, actual jsonb not null,
 note text not null default '', request_id uuid not null,
 created_by uuid references app_users(id) on delete set null,
 created_at timestamptz not null default now(),
 unique(restaurant_id,request_id)
);
create index finance_closings_date on finance_closings(restaurant_id,close_date desc,created_at desc);
create table finance_transfers (
 id uuid primary key default gen_random_uuid(),
 restaurant_id uuid not null references restaurants(id) on delete cascade,
 from_method text not null check(from_method in ('cash','transfer','qr','card','other')),
 to_method text not null check(to_method in ('cash','transfer','qr','card','other')),
 amount numeric(16,2) not null check(amount>0), entry_date date not null,
 note text not null, request_id uuid not null,
 created_by uuid references app_users(id) on delete set null,
 created_at timestamptz not null default now(),
 check(from_method<>to_method), unique(restaurant_id,request_id)
);
alter table orders add column cost_details jsonb;
-- Recipe costs use the latest known purchase price at payment time. Paid orders
-- retain their existing snapshots; no historical figures are recalculated.
create or replace function snapshot_paid_order_cost() returns trigger language plpgsql as $$
begin
 if new.paid and (tg_op='INSERT' or not old.paid) then
  with lines as (
   select i.value item,m.id,m.name,m.cost_price,
    case when (i.value->>'qty') ~ '^\d+(\.\d+)?$' then (i.value->>'qty')::numeric else 0 end qty,
    recipe.parts,recipe.unit_cost,recipe.missing
   from jsonb_array_elements(new.items) i
   left join menus m on m.id::text=i.value->>'menu_id' and m.restaurant_id=new.restaurant_id
   left join lateral (
    select count(*) parts,sum(c.quantity*p.unit_cost) unit_cost,
     count(*) filter(where p.unit_cost is null) missing
    from menu_inventory_components c
    left join lateral (select sm.unit_cost from stock_movements sm
      where sm.restaurant_id=new.restaurant_id and sm.inventory_item_id=c.inventory_item_id
       and sm.quantity_delta>0 and sm.unit_cost is not null and sm.occurred_at<=now()
      order by sm.occurred_at desc,sm.id desc limit 1) p on true
    where c.menu_id=m.id
   ) recipe on true
  ), valued as (
   select *,case when parts>0 then coalesce(unit_cost,0) else coalesce(cost_price,0) end unit,
    (id is null or qty<=0 or (parts>0 and missing>0) or (parts=0 and coalesce(cost_price,0)=0)) incomplete
   from lines
  ) select coalesce(round(sum(unit*qty),2),0),
    case when count(*)=0 then 1 else count(*) filter(where incomplete) end,
    coalesce(jsonb_agg(jsonb_build_object('menu_id',id,'name',coalesce(item->>'name',name),'qty',qty,
     'unit_cost',unit,'total_cost',round(unit*qty,2),'incomplete',incomplete)), '[]')
   into new.cost_total,new.cost_missing_count,new.cost_details from valued;
 end if;
 return new;
end $$;
