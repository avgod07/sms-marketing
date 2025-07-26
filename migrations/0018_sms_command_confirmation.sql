-- Migration for SMS Command Confirmation Flow
-- Adds pending commands table for two-step confirmation process

-- Create table for storing pending SMS commands awaiting confirmation
CREATE TABLE IF NOT EXISTS sms_command_pending (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  sender_phone VARCHAR(20) NOT NULL,
  message_content TEXT NOT NULL,
  contact_count INTEGER NOT NULL,
  credit_cost INTEGER NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  
  -- Ensure only one pending command per business at a time
  UNIQUE(business_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sms_pending_expires_at ON sms_command_pending(expires_at);
CREATE INDEX IF NOT EXISTS idx_sms_pending_business_sender ON sms_command_pending(business_id, sender_phone);

-- Create index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_sms_pending_cleanup ON sms_command_pending(expires_at) WHERE expires_at < NOW(); 