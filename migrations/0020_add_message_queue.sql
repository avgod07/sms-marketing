-- Migration: Add Message Queue Table  
-- Description: Adds message queue table for TCPA quiet hours compliance

-- Create message_queue table
CREATE TABLE message_queue (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
  phone_number VARCHAR(20) NOT NULL,
  message_content TEXT NOT NULL,
  message_type VARCHAR(50) NOT NULL,
  scheduled_for TIMESTAMP NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  metadata TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMP,
  error_message TEXT
);

-- Create optimized indexes for queue processing performance
CREATE INDEX message_queue_processing_idx ON message_queue(status, scheduled_for);
CREATE INDEX message_queue_business_id_idx ON message_queue(business_id);
CREATE INDEX message_queue_scheduled_for_idx ON message_queue(scheduled_for); 