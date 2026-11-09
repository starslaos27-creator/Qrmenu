create sequence if not exists receipt_number_seq;
alter table orders add column if not exists receipt_number text;

-- One number per historical payment group, retained for every reprint.
do $$
declare payment record; receipt text;
begin
  for payment in
    select restaurant_id, table_id, paid_at, payment_method
    from orders where paid = true and receipt_number is null
    group by restaurant_id, table_id, paid_at, payment_method
    order by paid_at nulls last, restaurant_id, table_id
  loop
    receipt := 'BILL-' || lpad(nextval('receipt_number_seq')::text, 8, '0');
    update orders set receipt_number = receipt
    where restaurant_id = payment.restaurant_id and table_id = payment.table_id
      and paid_at is not distinct from payment.paid_at
      and payment_method is not distinct from payment.payment_method
      and paid = true and receipt_number is null;
  end loop;
end $$;
