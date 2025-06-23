ALTER TABLE messages ADD COLUMN message_sid varchar(64);
ALTER TABLE messages ADD COLUMN error_code integer;
CREATE INDEX IF NOT EXISTS messages_status_idx ON messages (status);
CREATE INDEX IF NOT EXISTS messages_error_code_idx ON messages (error_code);
CREATE INDEX IF NOT EXISTS messages_sent_at_idx ON messages (sent_at);
CREATE INDEX IF NOT EXISTS messages_delivered_at_idx ON messages (delivered_at);
