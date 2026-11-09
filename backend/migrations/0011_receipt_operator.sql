alter table orders add column if not exists receipt_user text;
-- Recover the operator only when the settlement audit identifies this order.
update orders o set receipt_user = (
  select u.email from audit_logs a join app_users u on u.id = a.actor_user_id
  where a.restaurant_id = o.restaurant_id and a.action = 'bill.settle'
    and a.details->'order_ids' ? o.id::text
  order by a.created_at desc limit 1
)
where o.paid = true and o.receipt_user is null;
