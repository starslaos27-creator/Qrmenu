-- Freeze menu costs when an order is first paid. Old paid orders remain unknown;
-- do not invent historical costs from today's menu prices.
alter table orders add column cost_total numeric(20,2),
 add column cost_missing_count integer,
 add constraint orders_cost_nonnegative check (cost_total >= 0 and cost_missing_count >= 0);

create function snapshot_paid_order_cost() returns trigger language plpgsql as $$
begin
 if new.paid and (tg_op = 'INSERT' or not old.paid) then
  select coalesce(sum(coalesce(m.cost_price,0) *
    case when (i.value->>'qty') ~ '^\d+(\.\d+)?$' then (i.value->>'qty')::numeric else 0 end),0),
    case when count(*)=0 then 1 else count(*) filter(where m.id is null or m.cost_price=0
      or not coalesce((i.value->>'qty') ~ '^\d+(\.\d+)?$',false)) end
   into new.cost_total,new.cost_missing_count
   from jsonb_array_elements(new.items) i
   left join menus m on m.id::text=i.value->>'menu_id' and m.restaurant_id=new.restaurant_id;
 end if;
 return new;
end $$;
create trigger orders_snapshot_cost before insert or update of paid on orders
 for each row execute function snapshot_paid_order_cost();
