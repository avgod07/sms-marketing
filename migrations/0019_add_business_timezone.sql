-- Migration: Add Business Timezone Field
-- Description: Adds timezone field to businesses table for TCPA quiet hours compliance

-- Add timezone field to businesses table
ALTER TABLE businesses 
ADD COLUMN timezone VARCHAR(50) NOT NULL DEFAULT 'America/New_York';

-- Create index for timezone queries
CREATE INDEX idx_businesses_timezone ON businesses(timezone);

-- Update existing businesses with default timezone
-- Will be updated to accurate timezone when onboarding is completed
UPDATE businesses 
SET timezone = 'America/New_York' 
WHERE timezone IS NULL; 