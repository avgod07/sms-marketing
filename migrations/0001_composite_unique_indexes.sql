-- Drop old unique constraints
ALTER TABLE coupons DROP CONSTRAINT IF EXISTS "coupons_code_unique";

-- Add new composite unique indexes
CREATE UNIQUE INDEX IF NOT EXISTS coupons_business_id_code_idx
    ON coupons (business_id, code);
