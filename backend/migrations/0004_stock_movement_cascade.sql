-- Stock movements remain immutable during normal operation, while still allowing
-- PostgreSQL to remove their history as part of deleting the parent restaurant.

create or replace function protect_stock_movement()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE'
     and not exists (
       select 1
       from restaurants
       where id = old.restaurant_id
     ) then
    return old;
  end if;

  raise exception 'STOCK_MOVEMENTS_ARE_IMMUTABLE';
end;
$$;
