-- Migration: Add suppressed status support to message queue
-- Description: Extends status enum to support suppression for TCPA compliance

-- The status field is already VARCHAR(20) so no schema change needed
-- Just document the new status value for compliance tracking

COMMENT ON COLUMN message_queue.status IS 
'Valid values: pending, sent, failed, suppressed. Suppressed status used for TCPA compliance when contacts opt out.';

-- Optional: Add index for suppressed status queries (for compliance reporting)
CREATE INDEX CONCURRENTLY IF NOT EXISTS message_queue_suppressed_idx 
ON message_queue(status) WHERE status = 'suppressed'; 