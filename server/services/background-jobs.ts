import { QueueProcessor } from "./queue-processor.js";
import { logInfo, logError } from "../utils/logger.util.js";

/**
 * BackgroundJobs Service
 * Handles all background processing tasks including message queue processing
 */
export class BackgroundJobs {
  private static queueProcessorInterval: NodeJS.Timeout | null = null;
  private static scheduledCampaignsInterval: NodeJS.Timeout | null = null;
  private static isRunning = false;

  /**
   * Start all background jobs
   */
  static start(): void {
    if (this.isRunning) {
      logInfo("Background jobs already running");
      return;
    }

    logInfo("Starting background jobs");
    this.isRunning = true;

    // Start queue processor (runs every 15 minutes)
    this.startQueueProcessor();

    // Start scheduled campaigns processor (runs every 5 minutes)
    this.startScheduledCampaignsProcessor();

    logInfo("Background jobs started successfully");
  }

  /**
   * Stop all background jobs
   */
  static stop(): void {
    if (!this.isRunning) {
      logInfo("Background jobs not running");
      return;
    }

    logInfo("Stopping background jobs");

    // Stop queue processor
    if (this.queueProcessorInterval) {
      clearInterval(this.queueProcessorInterval);
      this.queueProcessorInterval = null;
    }

    // Stop scheduled campaigns processor
    if (this.scheduledCampaignsInterval) {
      clearInterval(this.scheduledCampaignsInterval);
      this.scheduledCampaignsInterval = null;
    }

    this.isRunning = false;
    logInfo("Background jobs stopped");
  }

  /**
   * Start the queue processor background job
   * Runs every 15 minutes to process queued messages
   */
  private static startQueueProcessor(): void {
    // Run immediately on startup
    this.runQueueProcessor();

    // Then run every 15 minutes
    this.queueProcessorInterval = setInterval(() => {
      this.runQueueProcessor();
    }, 15 * 60 * 1000); // 15 minutes in milliseconds

    logInfo("Queue processor started - runs every 15 minutes");
  }

  /**
   * Run a single queue processing cycle
   */
  private static async runQueueProcessor(): Promise<void> {
    try {
      logInfo("Running queue processor cycle");

      const stats = await QueueProcessor.processQueue();

      logInfo("Queue processor cycle completed", {
        totalProcessed: stats.totalProcessed,
        sentCount: stats.sentCount,
        rescheduledCount: stats.rescheduledCount,
        failedCount: stats.failedCount,
        businessCount: stats.businessCount,
        processingTimeMs: stats.processingTimeMs,
      });

      // Log performance warnings if processing is slow
      if (stats.processingTimeMs > 30000) {
        // More than 30 seconds
        logError("Queue processing taking too long", {
          processingTimeMs: stats.processingTimeMs,
          totalProcessed: stats.totalProcessed,
        });
      }

      // Log warnings if many messages are failing
      if (
        stats.failedCount > 0 &&
        stats.failedCount / Math.max(stats.totalProcessed, 1) > 0.1
      ) {
        logError("High failure rate in queue processing", {
          failedCount: stats.failedCount,
          totalProcessed: stats.totalProcessed,
          failureRate: stats.failedCount / stats.totalProcessed,
        });
      }
    } catch (error) {
      logError("Queue processor cycle failed", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }

  /**
   * Start the scheduled campaigns processor background job
   * Runs every 5 minutes to process campaigns ready to be sent
   */
  private static startScheduledCampaignsProcessor(): void {
    // Run immediately on startup
    this.runScheduledCampaignsProcessor();

    // Then run every 5 minutes
    this.scheduledCampaignsInterval = setInterval(() => {
      this.runScheduledCampaignsProcessor();
    }, 5 * 60 * 1000); // 5 minutes in milliseconds

    logInfo("Scheduled campaigns processor started - runs every 5 minutes");
  }

  /**
   * Run a single scheduled campaigns processing cycle
   */
  private static async runScheduledCampaignsProcessor(): Promise<void> {
    try {
      logInfo("Running scheduled campaigns processor cycle");

      const stats = await QueueProcessor.processScheduledCampaigns();

      logInfo("Scheduled campaigns processor cycle completed", {
        totalProcessed: stats.totalProcessed,
        sentCount: stats.sentCount,
        failedCount: stats.failedCount,
        campaignCount: stats.campaignCount,
        processingTimeMs: stats.processingTimeMs,
      });

      // Log performance warnings if processing is slow
      if (stats.processingTimeMs > 60000) {
        // More than 60 seconds
        logError("Scheduled campaigns processing taking too long", {
          processingTimeMs: stats.processingTimeMs,
          totalProcessed: stats.totalProcessed,
        });
      }

      // Log warnings if many campaigns are failing
      if (
        stats.failedCount > 0 &&
        stats.failedCount / Math.max(stats.totalProcessed, 1) > 0.2
      ) {
        logError("High failure rate in scheduled campaigns processing", {
          failedCount: stats.failedCount,
          totalProcessed: stats.totalProcessed,
          failureRate: stats.failedCount / stats.totalProcessed,
        });
      }
    } catch (error) {
      logError("Scheduled campaigns processor cycle failed", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }

  /**
   * Get status of background jobs
   */
  static getStatus() {
    return {
      isRunning: this.isRunning,
      queueProcessorActive: this.queueProcessorInterval !== null,
      scheduledCampaignsProcessorActive:
        this.scheduledCampaignsInterval !== null,
    };
  }

  /**
   * Manually trigger queue processing (for testing/admin purposes)
   */
  static async triggerQueueProcessing() {
    logInfo("Manually triggering queue processing");
    return await this.runQueueProcessor();
  }

  /**
   * Manually trigger scheduled campaigns processing (for testing/admin purposes)
   */
  static async triggerScheduledCampaignsProcessing() {
    logInfo("Manually triggering scheduled campaigns processing");
    return await this.runScheduledCampaignsProcessor();
  }
}
