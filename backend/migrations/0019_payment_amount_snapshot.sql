-- Preserve the amount actually charged, including the bill's service charge
-- and VAT. Legacy payments stay untouched; never apply today's tax to them.
alter table orders add column settled_total numeric(16,2),
 add column settled_service_pct numeric(5,2),
 add column settled_vat_pct numeric(5,2),
 add constraint orders_settled_total_nonnegative check(settled_total>=0);
