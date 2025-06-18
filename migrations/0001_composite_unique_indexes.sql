-- Drop old unique constraints
ALTER TABLE contacts DROP CONSTRAINT IF EXISTS "contacts_phone_number_unique";
ALTER TABLE coupons DROP CONSTRAINT IF EXISTS "coupons_code_unique";

-- Add new composite unique indexes
CREATE UNIQUE INDEX IF NOT EXISTS contacts_business_id_phone_number_idx
    ON contacts (business_id, phone_number);
CREATE UNIQUE INDEX IF NOT EXISTS coupons_business_id_code_idx
    ON coupons (business_id, code);
