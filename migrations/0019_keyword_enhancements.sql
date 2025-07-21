-- Migration for keyword campaign enhancements
-- Adds expiration dates, soft delete, and updates message length

-- Add new fields to keyword_campaigns table
ALTER TABLE keyword_campaigns 
ADD COLUMN expires_at TIMESTAMP,
ADD COLUMN deleted_at TIMESTAMP;

-- Update message column length to match campaign standard (160 chars)
ALTER TABLE keyword_campaigns 
ALTER COLUMN message TYPE VARCHAR(160);

-- Create indexes for new fields
CREATE INDEX keyword_campaigns_expires_at_idx ON keyword_campaigns (expires_at);
CREATE INDEX keyword_campaigns_deleted_at_idx ON keyword_campaigns (deleted_at);

-- Update existing keywords to ensure they don't exceed 160 chars (truncate if needed)
UPDATE keyword_campaigns 
SET message = LEFT(message, 160) 
WHERE LENGTH(message) > 160; 