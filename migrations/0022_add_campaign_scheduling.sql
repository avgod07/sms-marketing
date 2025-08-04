-- Migration: Add Campaign Scheduling Support
-- Description: Adds scheduling fields to campaigns table for user-scheduled campaigns

-- Add scheduling fields to campaigns table
ALTER TABLE campaigns ADD COLUMN scheduled_send_time TIMESTAMP;
ALTER TABLE campaigns ADD COLUMN scheduling_type VARCHAR(20) DEFAULT 'immediate' NOT NULL;
-- Values: 'immediate', 'scheduled', 'cancelled'
ALTER TABLE campaigns ADD COLUMN scheduled_by VARCHAR(64);
ALTER TABLE campaigns ADD COLUMN schedule_notes TEXT;

-- Update the status field to include scheduled status
-- Current values: 'in_progress', 'completed'
-- New values: 'in_progress', 'completed', 'scheduled', 'cancelled'

-- Create index for scheduled campaigns
CREATE INDEX campaigns_scheduled_idx ON campaigns(business_id, scheduled_send_time, scheduling_type) 
WHERE scheduling_type = 'scheduled';

-- Create index for efficient scheduling queries
CREATE INDEX campaigns_scheduling_type_idx ON campaigns(scheduling_type, scheduled_send_time); 