-- Add billing_status column to messages table
ALTER TABLE messages ADD COLUMN billing_status TEXT NOT NULL DEFAULT 'success';

-- Create index for billing_status column for performance
CREATE INDEX messages_billing_status_idx ON messages USING btree (billing_status);

-- All existing messages should have successful billing (since they were created under old system)
-- The default value of 'success' handles this automatically 