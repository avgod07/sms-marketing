-- Add TFV support to track toll-free verification status
-- This replaces the need for complex A2P registration

ALTER TABLE business_phone_numbers 
ADD COLUMN IF NOT EXISTS tfv_sid VARCHAR(64);

-- Add index for efficient TFV lookups
CREATE INDEX IF NOT EXISTS idx_business_phone_numbers_tfv_sid 
ON business_phone_numbers(tfv_sid) WHERE tfv_sid IS NOT NULL;

-- Add verification status tracking with correct Twilio status values
ALTER TABLE business_phone_numbers 
ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'PENDING_REVIEW';

-- Update existing phone numbers to correct Twilio status
UPDATE business_phone_numbers 
SET verification_status = 'PENDING_REVIEW' 
WHERE verification_status IS NULL OR verification_status = 'pending';

-- Fix any incorrect status values to match Twilio's API
UPDATE business_phone_numbers 
SET verification_status = 'TWILIO_APPROVED' 
WHERE verification_status = 'APPROVED' OR verification_status = 'approved';

UPDATE business_phone_numbers 
SET verification_status = 'TWILIO_REJECTED' 
WHERE verification_status = 'DENIED' OR verification_status = 'denied';

UPDATE business_phone_numbers 
SET verification_status = 'PENDING_REVIEW' 
WHERE verification_status = 'pending'; 