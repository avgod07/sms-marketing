-- Migration: Add performance indexes for fair rate-limited queue processing
-- This migration adds optimized indexes to support the new fair processing system
-- which runs every 1 minute instead of 15 minutes, requiring better query performance

-- Index for efficiently finding messages ready to send
-- This is the most critical query for queue processing
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_message_queue_ready_to_send 
ON message_queue(scheduled_for, status) 
WHERE status = 'pending';

-- Index for efficiently finding scheduled campaigns ready to execute
-- This supports the scheduled campaigns processor (every 30 seconds)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_scheduled_ready 
ON campaigns(scheduled_send_time, status, scheduling_type) 
WHERE status = 'scheduled' AND scheduling_type = 'scheduled';

-- Composite index for business-specific queue operations
-- Helps with fair distribution across businesses
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_message_queue_business_status 
ON message_queue(business_id, status, scheduled_for) 
WHERE status IN ('pending', 'processing');

-- Index for queue statistics and monitoring
-- Supports queue stats queries that may be called more frequently
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_message_queue_status_created 
ON message_queue(status, created_at);

-- Index for campaign message tracking
-- Helps with campaign-specific queue operations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_message_queue_metadata_campaign 
ON message_queue USING gin(metadata) 
WHERE metadata IS NOT NULL;

-- Update statistics for the query planner
ANALYZE message_queue;
ANALYZE campaigns;

-- Add helpful comments for future reference
COMMENT ON INDEX idx_message_queue_ready_to_send IS 'Optimizes getMessagesReadyToSend() query for fair rate limiting (1min frequency)';
COMMENT ON INDEX idx_campaigns_scheduled_ready IS 'Optimizes scheduled campaign lookup for 30-second processing cycle';
COMMENT ON INDEX idx_message_queue_business_status IS 'Supports fair distribution by business in rate-limited processor';
COMMENT ON INDEX idx_message_queue_status_created IS 'Optimizes queue statistics and monitoring queries';
COMMENT ON INDEX idx_message_queue_metadata_campaign IS 'Supports campaign-specific message operations and tracking'; 