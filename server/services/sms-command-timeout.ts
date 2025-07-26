import { SMSCommandPending } from "./sms-command-pending.js";
import { logInfo, logError } from "../utils/logger.util.js";

/**
 * Service to handle periodic cleanup of expired SMS commands
 */
export class SMSCommandTimeoutService {
  private static isRunning = false;
  private static cleanupInterval: NodeJS.Timeout | null = null;

  /**
   * Start periodic checking with a specified interval
   * @param intervalMs - Interval in milliseconds (default: 30 seconds)
   */
  static startPeriodicCleanup(intervalMs: number = 30000): NodeJS.Timeout {
    if (this.cleanupInterval) {
      logInfo(
        "SMS command cleanup already running, stopping previous interval"
      );
      clearInterval(this.cleanupInterval);
    }

    logInfo(`Starting SMS command cleanup with ${intervalMs}ms interval`);

    this.cleanupInterval = setInterval(async () => {
      if (this.isRunning) {
        return; // Skip if already running
      }

      this.isRunning = true;
      try {
        const cleaned = await SMSCommandPending.cleanupExpiredCommands();
        if (cleaned > 0) {
          logInfo(
            `SMS command cleanup completed: ${cleaned} expired commands removed`
          );
        }
      } catch (error) {
        logError("SMS command cleanup failed:", error);
      } finally {
        this.isRunning = false;
      }
    }, intervalMs);

    return this.cleanupInterval;
  }

  /**
   * Stop the periodic cleanup
   */
  static stopPeriodicCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      logInfo("Stopped SMS command periodic cleanup");
    }
  }

  /**
   * Run a single cleanup operation manually
   */
  static async runCleanup(): Promise<number> {
    if (this.isRunning) {
      logInfo("Cleanup already running, skipping manual cleanup");
      return 0;
    }

    this.isRunning = true;
    try {
      const cleaned = await SMSCommandPending.cleanupExpiredCommands();
      logInfo(
        `Manual SMS command cleanup completed: ${cleaned} expired commands removed`
      );
      return cleaned;
    } catch (error) {
      logError("Manual SMS command cleanup failed:", error);
      return 0;
    } finally {
      this.isRunning = false;
    }
  }
}
