-- SAFE FIX: Remove global username uniqueness and add business-scoped constraint
-- This fixes the multi-tenancy violation for usernames while preserving Clerk's global clerk_id requirement

-- Step 1: Drop the global unique constraint on username
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_unique;

-- Step 2: Add composite unique constraint for business-scoped username uniqueness
-- This allows the same username to exist across different businesses
-- but prevents duplicates within a single business
CREATE UNIQUE INDEX IF NOT EXISTS users_business_id_username_idx 
    ON users (business_id, username);

-- Step 3: Add index for performance on username lookups within a business
CREATE INDEX IF NOT EXISTS users_business_id_username_lookup_idx 
    ON users (business_id, username);

-- Step 4: Verify the constraint is properly applied
-- This will fail if there are any existing duplicate usernames within the same business
-- (which would indicate data integrity issues that need to be resolved first) 