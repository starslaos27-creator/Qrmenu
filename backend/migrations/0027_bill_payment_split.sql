alter table bill_payment_details
  add column if not exists transfer_amount numeric(16,2) not null default 0;

do $$
declare constraint_row record;
begin
  for constraint_row in
    select conname
    from pg_constraint
    where conrelid = 'bill_payment_details'::regclass
      and contype = 'c'
      and (pg_get_constraintdef(oid) ilike '%cash_received%'
        or pg_get_constraintdef(oid) ilike '%payment_method%')
  loop
    execute format('alter table bill_payment_details drop constraint %I', constraint_row.conname);
  end loop;
end $$;

alter table bill_payment_details
  add constraint bill_payment_details_method_check
    check (payment_method in ('cash','transfer','promptpay','card','other','mixed')),
  add constraint bill_payment_details_split_check
    check (
      (payment_method = 'cash'
        and cash_received is not null and cash_received >= bill_total
        and transfer_amount = 0 and change_due = cash_received - bill_total)
      or (payment_method = 'mixed'
        and cash_received is not null and transfer_amount > 0 and transfer_amount < bill_total
        and cash_received + transfer_amount >= bill_total
        and change_due = cash_received + transfer_amount - bill_total)
      or (payment_method in ('transfer','promptpay')
        and cash_received is null and transfer_amount = bill_total and change_due = 0)
      or (payment_method in ('card','other')
        and cash_received is null and transfer_amount = 0 and change_due = 0)
    );
