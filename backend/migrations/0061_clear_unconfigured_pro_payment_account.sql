-- Remove only the original migration-seeded account if no admin has configured it.
-- Accounts saved through the admin form have updated_by set and remain untouched.
delete from pro_payment_bank_details
where id = true
  and updated_by is null
  and account_number = '010120100057276001'
  and account_name = 'Sonesay CHANGPACHENG';
