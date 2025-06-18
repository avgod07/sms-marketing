-- Revert contact phone index to global uniqueness
DROP INDEX IF EXISTS contacts_business_id_phone_number_idx;
ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_phone_number_unique;
ALTER TABLE contacts ADD CONSTRAINT contacts_phone_number_unique UNIQUE(phone_number);
