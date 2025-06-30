-- CRITICAL FIX: Remove global phone number uniqueness and add business-scoped constraint
-- This fixes the multi-tenancy violation where phone numbers were globally unique

-- Step 1: Drop the global unique constraint on phone_number
ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_phone_number_unique;

-- Step 2: Add composite unique constraint for business-scoped phone number uniqueness
-- This allows the same phone number to exist across different businesses
-- but prevents duplicates within a single business
CREATE UNIQUE INDEX IF NOT EXISTS contacts_business_id_phone_number_idx 
    ON contacts (business_id, phone_number);

-- Step 3: Add index for performance on phone number lookups within a business
CREATE INDEX IF NOT EXISTS contacts_business_id_phone_number_lookup_idx 
    ON contacts (business_id, phone_number);

-- Step 4: Verify the constraint is properly applied
-- This will fail if there are any existing duplicate phone numbers within the same business
-- (which would indicate data integrity issues that need to be resolved first) 