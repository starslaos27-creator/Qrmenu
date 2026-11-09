alter table finance_entries
  add column currency_code text not null default 'LAK',
  add column currency_amount numeric(16,2),
  add column exchange_rate numeric(20,8) not null default 1;

update finance_entries set currency_amount = amount where currency_amount is null;

alter table finance_entries
  alter column currency_amount set not null,
  add constraint finance_entries_currency_code_check check (currency_code in ('LAK','THB','USD')),
  add constraint finance_entries_currency_amount_check check (currency_amount > 0 and currency_amount <= 999999999999.99),
  add constraint finance_entries_exchange_rate_check check (exchange_rate > 0 and exchange_rate <= 999999999999.99999999);
