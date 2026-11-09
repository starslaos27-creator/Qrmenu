alter table restaurants
  add column if not exists currency_code text not null default 'LAK'
    check (currency_code in ('LAK', 'THB', 'USD'));
