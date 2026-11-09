alter table stock_deposits
  add column if not exists meal_count integer
  check (meal_count is null or meal_count between 1 and 10000);
