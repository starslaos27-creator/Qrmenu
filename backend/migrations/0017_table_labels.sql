ALTER TABLE tables DROP CONSTRAINT IF EXISTS tables_table_number_check;
ALTER TABLE tables ALTER COLUMN table_number TYPE text USING table_number::text;
ALTER TABLE tables ADD CONSTRAINT tables_table_number_check
  CHECK (length(btrim(table_number)) BETWEEN 1 AND 30 AND table_number !~ '[[:cntrl:]]');
