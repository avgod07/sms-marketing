-- Cleanup old A2P-specific fields that are no longer needed
-- These were replaced by TFV implementation

-- Remove A2P-specific SID fields from business profiles
-- These were used for A2P registration but not needed for TFV
ALTER TABLE business_profiles 
DROP COLUMN IF EXISTS customer_profile_sid,
DROP COLUMN IF EXISTS brand_sid,
DROP COLUMN IF EXISTS campaign_sid,
DROP COLUMN IF EXISTS registration_status;

-- Rename A2P config table to be more generic since we still need use cases and volume for TFV
ALTER TABLE twilio_a2p_config RENAME TO messaging_config;

-- Update the unique constraint name to match the new table name
ALTER INDEX twilio_a2p_config_business_id_unique RENAME TO messaging_config_business_id_unique;

-- The table content (use_cases, volume) is still needed for TFV submissions
-- so we keep the data and just rename the table for clarity 