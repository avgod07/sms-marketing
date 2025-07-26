import { QueueProcessor } from "./queue-processor.js";
import { logInfo, logError } from "../utils/logger.util.js";

/**
 * BackgroundJobs Service
 * Handles all background processing tasks including message queue processing
 */
export class BackgroundJobs {
  private static queueProcessorInterval: NodeJS.Timeout | null = null;
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
   * Get status of background jobs
   */
  static getStatus() {
    return {
      isRunning: this.isRunning,
      queueProcessorActive: this.queueProcessorInterval !== null,
    };
  }

  /**
   * Manually trigger queue processing (for testing/admin purposes)
   */
  static async triggerQueueProcessing() {
    logInfo("Manually triggering queue processing");
    return await this.runQueueProcessor();
  }
}
