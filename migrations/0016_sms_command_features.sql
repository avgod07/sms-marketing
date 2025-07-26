-- Migration: Add SMS Command Features
-- Description: Adds SMS command sender authorization, rate limiting, and campaign source tracking

-- Add fields to existing campaigns table
ALTER TABLE campaigns ADD COLUMN campaign_source TEXT DEFAULT 'manual' NOT NULL;
ALTER TABLE campaigns ADD COLUMN command_sender_phone VARCHAR(20);

-- Create SMS command senders table for authorization
CREATE TABLE sms_command_senders (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  phone_number VARCHAR(20) NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  added_by_user_id INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE(business_id, phone_number)
);

-- Create SMS command rate limits table
CREATE TABLE sms_command_rate_limits (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE UNIQUE,
  last_command_at TIMESTAMP,
  next_available_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes for better performance
CREATE INDEX idx_sms_command_senders_business_phone ON sms_command_senders(business_id, phone_number);
CREATE INDEX idx_sms_command_senders_active ON sms_command_senders(business_id, is_active);
CREATE INDEX idx_sms_command_rate_limits_business ON sms_command_rate_limits(business_id);
CREATE INDEX idx_campaigns_source ON campaigns(campaign_source);
CREATE INDEX idx_campaigns_command_sender ON campaigns(command_sender_phone); 