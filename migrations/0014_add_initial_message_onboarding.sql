-- Add initial_message and onboarding_complete fields to businesses table
ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS initial_message TEXT,
ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE;

-- Create index for onboarding_complete for better query performance
CREATE INDEX IF NOT EXISTS idx_businesses_onboarding_complete ON businesses(onboarding_complete);

-- Update existing businesses to have onboarding_complete = true if they have completed onboarding
-- This is based on the existing users.onboarding_complete field
UPDATE businesses 
SET onboarding_complete = true 
WHERE id IN (
  SELECT DISTINCT business_id 
  FROM users 
  WHERE onboarding_complete = true
); 