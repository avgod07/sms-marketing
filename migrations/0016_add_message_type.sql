-- Add messageType column to messages table
ALTER TABLE messages ADD COLUMN message_type TEXT NOT NULL DEFAULT 'regular';

-- Create index for messageType column
CREATE INDEX messages_message_type_idx ON messages USING btree (message_type);

-- Backfill existing data with appropriate message types
-- Set received messages
UPDATE messages SET message_type = 'received' WHERE status = 'received';

-- Set campaign messages (messages that have a campaignId)
UPDATE messages SET message_type = 'campaign' WHERE campaign_id IS NOT NULL AND status != 'received';

-- Set initial messages (assumption: sent messages without campaignId that aren't received)
UPDATE messages SET message_type = 'initial' WHERE status = 'sent' AND campaign_id IS NULL AND message_type = 'regular';

-- All other messages remain as 'regular' (direct inbox messages) 