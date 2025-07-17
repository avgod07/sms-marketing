-- Add TFV support to track toll-free verification status
-- This replaces the need for complex A2P registration

ALTER TABLE business_phone_numbers 
ADD COLUMN IF NOT EXISTS tfv_sid VARCHAR(64);

-- Add index for efficient TFV lookups
CREATE INDEX IF NOT EXISTS idx_business_phone_numbers_tfv_sid 
ON business_phone_numbers(tfv_sid) WHERE tfv_sid IS NOT NULL;

-- Add verification status tracking
ALTER TABLE business_phone_numbers 
ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending';

-- Update existing phone numbers to pending status
UPDATE business_phone_numbers 
SET verification_status = 'pending' 
WHERE verification_status IS NULL; 