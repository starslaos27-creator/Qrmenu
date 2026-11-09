-- Reserve the receipt reference before kitchen printing. All open orders at a
-- table share it; printed references survive settlement and table transfers.
lock table tables, orders in share row exclusive mode;

do $$
declare bill record; number text;
begin
  for bill in
    select restaurant_id, table_id, min(receipt_number) as existing_number
    from orders where paid = false and status <> 'cancelled'
    group by restaurant_id, table_id
  loop
    number := coalesce(bill.existing_number,
      'BILL-' || lpad(nextval('receipt_number_seq')::text, 8, '0'));
    update orders set receipt_number = number
    where restaurant_id = bill.restaurant_id and table_id = bill.table_id
      and paid = false and status <> 'cancelled' and receipt_number is null;
  end loop;
end $$;

create or replace function reserve_order_receipt_number() returns trigger
language plpgsql as $$
begin
  if TG_OP = 'UPDATE' then
    -- Also protects printed references while an older server is still running.
    if OLD.receipt_number is not null then
      NEW.receipt_number := OLD.receipt_number;
    end if;
    return NEW;
  end if;
  if NEW.receipt_number is not null then return NEW; end if;
  perform id from tables
    where id = NEW.table_id and restaurant_id = NEW.restaurant_id for update;
  if NEW.paid = false and NEW.status <> 'cancelled' then
    select receipt_number into NEW.receipt_number from orders
    where restaurant_id = NEW.restaurant_id and table_id = NEW.table_id
      and paid = false and status <> 'cancelled' and receipt_number is not null
    order by created_at, id limit 1;
  end if;
  if NEW.receipt_number is null then
    NEW.receipt_number := 'BILL-' || lpad(nextval('receipt_number_seq')::text, 8, '0');
  end if;
  return NEW;
end $$;

create trigger orders_reserve_receipt_number
before insert or update of receipt_number on orders
for each row execute function reserve_order_receipt_number();
