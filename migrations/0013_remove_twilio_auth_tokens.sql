-- Migration: Remove Twilio Auth Tokens from Database
-- This migration removes the authTokenEncrypted column from twilio_credentials table
-- as part of the transition to a single, centrally managed Twilio account architecture.
-- Auth tokens will now be managed exclusively through environment variables.

-- Remove the authTokenEncrypted column from twilio_credentials table
ALTER TABLE twilio_credentials DROP COLUMN IF EXISTS auth_token_encrypted;

-- Add a comment to document this architectural change
COMMENT ON TABLE twilio_credentials IS 'Twilio credentials table - auth tokens now managed via environment variables for enhanced security';

-- Update existing records to use the centralized account SID from environment
-- This ensures all businesses use the same Twilio account
UPDATE twilio_credentials 
SET account_sid = COALESCE(
    (SELECT value FROM pg_settings WHERE name = 'application_name'), 
    'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
)
WHERE account_sid IS NOT NULL;

-- Add an index on account_sid for better performance on webhook lookups
CREATE INDEX IF NOT EXISTS idx_twilio_credentials_account_sid 
ON twilio_credentials(account_sid); 