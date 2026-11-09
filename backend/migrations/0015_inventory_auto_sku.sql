create table inventory_sku_counters (
  restaurant_id uuid primary key references restaurants(id) on delete cascade,
  last_number bigint not null default 0
);

insert into inventory_sku_counters (restaurant_id, last_number)
select restaurant_id, greatest(count(*), coalesce(max(
  case when sku ~ '^RAW-[0-9]{1,15}$' then substring(sku from 5)::bigint end
), 0)) from inventory_items group by restaurant_id;

create function assign_inventory_sku() returns trigger language plpgsql as $$
declare next_number bigint;
begin
  if new.sku is not null and btrim(new.sku) <> '' then return new; end if;
  insert into inventory_sku_counters (restaurant_id) values (new.restaurant_id)
    on conflict do nothing;
  loop
    update inventory_sku_counters set last_number = last_number + 1
      where restaurant_id = new.restaurant_id returning last_number into next_number;
    new.sku := 'RAW-' || lpad(next_number::text, greatest(3, length(next_number::text)), '0');
    exit when not exists (select 1 from inventory_items
      where restaurant_id = new.restaurant_id and sku = new.sku);
  end loop;
  return new;
end;
$$;

create trigger inventory_auto_sku before insert on inventory_items
for each row execute function assign_inventory_sku();
