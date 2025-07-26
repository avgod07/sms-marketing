-- Add timezone_updated_at field to track manual timezone changes
ALTER TABLE businesses ADD COLUMN timezone_updated_at TIMESTAMP; 