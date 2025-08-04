import { Express, Request, Response } from "express";
import { requireAuth } from "@clerk/express";
import { BackgroundJobs } from "../../services/background-jobs.js";
import { MessageQueueService } from "../../services/message-queue.js";
import { QueueProcessor } from "../../services/queue-processor.js";
import { logInfo, logError } from "../../utils/logger.util.js";

export function registerAdminRoutes(app: Express) {
  /**
   * Get queue processing status and stats
   */
  app.get(
    "/api/admin/queue/status",
    requireAuth(),
    async (req: Request, res: Response) => {
      try {
        const backgroundJobsStatus = BackgroundJobs.getStatus();
        const queueStats = await MessageQueueService.getQueueStats();

        res.json({
          backgroundJobs: backgroundJobsStatus,
          queueStats,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logError("Failed to get queue status", { error });
        res.status(500).json({
          message: "Failed to get queue status",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  /**
   * Manually trigger queue processing
   */
  app.post(
    "/api/admin/queue/process",
    requireAuth(),
    async (req: Request, res: Response) => {
      try {
        logInfo("Manual queue processing triggered", {
          triggeredBy: (req as any).user?.id,
        });

        const stats = await QueueProcessor.processQueue();

        res.json({
          success: true,
          message: "Queue processing completed",
          stats,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logError("Manual queue processing failed", {
          error,
          triggeredBy: (req as any).user?.id,
        });
        res.status(500).json({
          success: false,
          message: "Queue processing failed",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  /**
   * Get pending messages in queue (paginated)
   */
  app.get(
    "/api/admin/queue/pending",
    requireAuth(),
    async (req: Request, res: Response) => {
      try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = Math.min(parseInt(req.query.limit as string) || 50, 100); // Max 100 per page

        const pendingMessages = await MessageQueueService.getPendingMessages(
          page,
          limit
        );

        res.json({
          messages: pendingMessages,
          pagination: {
            page,
            limit,
            hasMore: pendingMessages.length === limit,
          },
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logError("Failed to get pending messages", { error });
        res.status(500).json({
          message: "Failed to get pending messages",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  /**
   * Get failed messages in queue (paginated)
   */
  app.get(
    "/api/admin/queue/failed",
    requireAuth(),
    async (req: Request, res: Response) => {
      try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = Math.min(parseInt(req.query.limit as string) || 50, 100); // Max 100 per page

        const failedMessages = await MessageQueueService.getFailedMessages(
          page,
          limit
        );

        res.json({
          messages: failedMessages,
          pagination: {
            page,
            limit,
            hasMore: failedMessages.length === limit,
          },
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logError("Failed to get failed messages", { error });
        res.status(500).json({
          message: "Failed to get failed messages",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  /**
   * Retry a specific failed message
   */
  app.post(
    "/api/admin/queue/retry/:messageId",
    requireAuth(),
    async (req: Request, res: Response) => {
      try {
        const messageId = parseInt(req.params.messageId);
        if (isNaN(messageId)) {
          return res.status(400).json({ message: "Invalid message ID" });
        }

        // Reschedule the message for immediate processing
        const nextSendTime = new Date(Date.now() + 1000); // 1 second from now
        await MessageQueueService.rescheduleMessage(messageId, nextSendTime);

        logInfo("Message retry scheduled", {
          messageId,
          retriedBy: (req as any).user?.id,
          nextSendTime: nextSendTime.toISOString(),
        });

        res.json({
          success: true,
          message: "Message scheduled for retry",
          messageId,
          nextSendTime: nextSendTime.toISOString(),
        });
      } catch (error) {
        logError("Failed to retry message", {
          messageId: req.params.messageId,
          error,
          retriedBy: (req as any).user?.id,
        });
        res.status(500).json({
          success: false,
          message: "Failed to retry message",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );
}
