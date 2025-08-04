-- Migration: Add Queue ID Reference to Messages Table
-- Description: Adds queueId field to messages table to track queued messages for TCPA compliance

-- Add queueId field to messages table
ALTER TABLE messages 
ADD COLUMN queue_id INTEGER REFERENCES message_queue(id);

-- Create index for queue_id queries
CREATE INDEX messages_queue_id_idx ON messages(queue_id); 