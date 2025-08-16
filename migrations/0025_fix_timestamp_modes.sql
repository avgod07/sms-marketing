-- Migration: Fix Timestamp Modes for Proper Timezone Handling
-- Description: Converts timestamp columns from string mode to proper TIMESTAMP WITH TIME ZONE
-- This fixes the core issue where timestamps were returned as strings instead of Date objects

-- Drop existing indexes that might conflict with type changes
DROP INDEX IF EXISTS messages_delivered_at_idx;

-- Convert timestamp columns from string mode to proper timestamp with timezone
-- This will automatically handle the conversion from string to timestamp
ALTER TABLE messages 
  ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE USING created_at::timestamp,
  ALTER COLUMN sent_at TYPE TIMESTAMP WITH TIME ZONE USING CASE 
    WHEN sent_at IS NOT NULL AND sent_at != '' THEN sent_at::timestamp 
    ELSE NULL 
  END,
  ALTER COLUMN delivered_at TYPE TIMESTAMP WITH TIME ZONE USING CASE 
    WHEN delivered_at IS NOT NULL AND delivered_at != '' THEN delivered_at::timestamp 
    ELSE NULL 
  END;

-- Recreate the delivered_at index with proper timestamp operations
CREATE INDEX messages_delivered_at_idx ON messages USING btree (delivered_at ASC NULLS LAST);

-- Add comments for clarity
COMMENT ON COLUMN messages.created_at IS 'Message creation timestamp in UTC, displayed in business timezone on frontend';
COMMENT ON COLUMN messages.sent_at IS 'Message sent timestamp in UTC, displayed in business timezone on frontend';
COMMENT ON COLUMN messages.delivered_at IS 'Message delivery timestamp in UTC, displayed in business timezone on frontend'; 