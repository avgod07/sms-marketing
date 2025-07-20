-- Migration: Add messaging_service_sid to businesses table
-- This migration adds messaging service SID directly to businesses table
-- and migrates existing data from twilio_credentials table

-- Add the messaging_service_sid column to businesses table
ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS messaging_service_sid VARCHAR(64);

-- Migrate existing messaging service SIDs from twilio_credentials to businesses
UPDATE businesses 
SET messaging_service_sid = tc.messaging_service_sid
FROM twilio_credentials tc 
WHERE businesses.id = tc.business_id 
AND businesses.messaging_service_sid IS NULL
AND tc.messaging_service_sid IS NOT NULL;

-- Add comment to document the purpose
COMMENT ON COLUMN businesses.messaging_service_sid IS 'Twilio messaging service SID for this business. Twilio account credentials come from environment variables.'; 