import { logInfo, logError } from "../utils/logger.util.js";
import { FairRateLimitedProcessor } from "./fair-rate-limited-processor.js";
import { MessageQueueService } from "./message-queue.js";

export interface FairProcessorMetrics {
  // Rate limiting metrics
  averageMessagesPerSecond: number;
  peakMessagesPerSecond: number;
  accountLimitUtilization: number; // percentage of 25 MPS limit used

  // Fairness metrics
  businessesActive: number;
  messagesPerBusinessAverage: number;
  messagesPerBusinessStdDev: number;
  fairnessIndex: number; // 0-1, where 1 is perfectly fair

  // Performance metrics
  averageProcessingTimeMs: number;
  queueSizeAverage: number;
  queueSizePeak: number;

  // System health
  errorRate: number;
  suppressionRate: number;
  queueBacklogMinutes: number;

  timestamp: Date;
}

export interface BusinessMetrics {
  businessId: number;
  messagesProcessed: number;
  averageWaitTimeMs: number;
  successRate: number;
  lastProcessedAt: Date;
}

/**
 * FairProcessorMonitor
 * Monitors and tracks performance metrics for the fair rate-limited processor
 */
export class FairProcessorMonitor {
  private static metrics: FairProcessorMetrics[] = [];
  private static businessMetrics: Map<number, BusinessMetrics> = new Map();
  private static readonly MAX_METRICS_HISTORY = 288; // 24 hours at 5-minute intervals

  // Monitoring configuration
  private static readonly MONITORING_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
  private static monitoringInterval: NodeJS.Timeout | null = null;
  private static isMonitoring = false;

  /**
   * Start monitoring the fair processor
   */
  static startMonitoring(): void {
    if (this.isMonitoring) {
      logInfo("Fair processor monitoring already running");
      return;
    }

    this.isMonitoring = true;

    // Collect metrics immediately
    this.collectMetrics();

    // Then collect every 5 minutes
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, this.MONITORING_INTERVAL_MS);

    logInfo(
      "Fair processor monitoring started - collecting metrics every 5 minutes"
    );
  }

  /**
   * Stop monitoring
   */
  static stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.isMonitoring = false;
    logInfo("Fair processor monitoring stopped");
  }

  /**
   * Collect current performance metrics
   */
  private static async collectMetrics(): Promise<void> {
    try {
      const queueStatus = FairRateLimitedProcessor.getQueueStatus();
      const processorStats = FairRateLimitedProcessor.getStats();
      const queueStats = await MessageQueueService.getQueueStats();

      // Calculate rate limiting metrics
      const accountLimitUtilization = this.calculateAccountLimitUtilization();
      const averageMessagesPerSecond = this.calculateAverageMessagesPerSecond();
      const peakMessagesPerSecond = this.calculatePeakMessagesPerSecond();

      // Calculate fairness metrics
      const fairnessMetrics = this.calculateFairnessMetrics();

      // Calculate performance metrics
      const performanceMetrics =
        this.calculatePerformanceMetrics(processorStats);

      // Calculate system health metrics
      const healthMetrics = this.calculateHealthMetrics(
        queueStats,
        processorStats
      );

      const currentMetrics: FairProcessorMetrics = {
        averageMessagesPerSecond,
        peakMessagesPerSecond,
        accountLimitUtilization,
        businessesActive: queueStatus.businessCount,
        messagesPerBusinessAverage: fairnessMetrics.messagesPerBusinessAverage,
        messagesPerBusinessStdDev: fairnessMetrics.messagesPerBusinessStdDev,
        fairnessIndex: fairnessMetrics.fairnessIndex,
        averageProcessingTimeMs: performanceMetrics.averageProcessingTimeMs,
        queueSizeAverage: performanceMetrics.queueSizeAverage,
        queueSizePeak: performanceMetrics.queueSizePeak,
        errorRate: healthMetrics.errorRate,
        suppressionRate: healthMetrics.suppressionRate,
        queueBacklogMinutes: healthMetrics.queueBacklogMinutes,
        timestamp: new Date(),
      };

      // Store metrics (keep only recent history)
      this.metrics.push(currentMetrics);
      if (this.metrics.length > this.MAX_METRICS_HISTORY) {
        this.metrics.shift();
      }

      // Log key metrics periodically
      this.logKeyMetrics(currentMetrics);

      // Check for alerts
      this.checkAlerts(currentMetrics);
    } catch (error) {
      logError("Failed to collect fair processor metrics", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Calculate account-level MPS limit utilization
   */
  private static calculateAccountLimitUtilization(): number {
    if (this.metrics.length < 2) return 0;

    const recent = this.metrics.slice(-5); // Last 5 metrics (25 minutes)
    const totalMessages = recent.reduce(
      (sum, m) => sum + m.averageMessagesPerSecond * 300,
      0
    ); // 5min intervals
    const totalSeconds = recent.length * 300;
    const averageMPS = totalMessages / totalSeconds;

    return Math.min(100, (averageMPS / 25) * 100); // 25 is our account limit
  }

  /**
   * Calculate average messages per second over recent period
   */
  private static calculateAverageMessagesPerSecond(): number {
    const stats = FairRateLimitedProcessor.getStats();
    if (stats.processingTimeMs === 0) return 0;

    return (stats.totalProcessed / stats.processingTimeMs) * 1000;
  }

  /**
   * Calculate peak messages per second
   */
  private static calculatePeakMessagesPerSecond(): number {
    if (this.metrics.length === 0) return 0;

    return Math.max(...this.metrics.map((m) => m.averageMessagesPerSecond));
  }

  /**
   * Calculate fairness metrics across businesses
   */
  private static calculateFairnessMetrics() {
    const businessCounts = Array.from(this.businessMetrics.values()).map(
      (b) => b.messagesProcessed
    );

    if (businessCounts.length === 0) {
      return {
        messagesPerBusinessAverage: 0,
        messagesPerBusinessStdDev: 0,
        fairnessIndex: 1,
      };
    }

    const average =
      businessCounts.reduce((sum, count) => sum + count, 0) /
      businessCounts.length;
    const variance =
      businessCounts.reduce(
        (sum, count) => sum + Math.pow(count - average, 2),
        0
      ) / businessCounts.length;
    const stdDev = Math.sqrt(variance);

    // Fairness index: 1 - (coefficient of variation)
    const fairnessIndex = average > 0 ? Math.max(0, 1 - stdDev / average) : 1;

    return {
      messagesPerBusinessAverage: average,
      messagesPerBusinessStdDev: stdDev,
      fairnessIndex,
    };
  }

  /**
   * Calculate performance metrics
   */
  private static calculatePerformanceMetrics(processorStats: any) {
    const recentMetrics = this.metrics.slice(-12); // Last hour

    return {
      averageProcessingTimeMs: processorStats.processingTimeMs || 0,
      queueSizeAverage:
        recentMetrics.length > 0
          ? recentMetrics.reduce((sum, m) => sum + m.queueSizeAverage, 0) /
            recentMetrics.length
          : 0,
      queueSizePeak:
        recentMetrics.length > 0
          ? Math.max(...recentMetrics.map((m) => m.queueSizePeak || 0))
          : 0,
    };
  }

  /**
   * Calculate system health metrics
   */
  private static calculateHealthMetrics(queueStats: any, processorStats: any) {
    const totalProcessed = processorStats.totalProcessed || 1;

    return {
      errorRate: (processorStats.failedCount || 0) / totalProcessed,
      suppressionRate: (processorStats.suppressedCount || 0) / totalProcessed,
      queueBacklogMinutes: this.calculateQueueBacklogMinutes(queueStats),
    };
  }

  /**
   * Calculate estimated queue backlog in minutes
   */
  private static calculateQueueBacklogMinutes(queueStats: any): number {
    const pendingMessages = queueStats.pending || 0;
    if (pendingMessages === 0) return 0;

    // Estimate based on 25 MPS processing rate
    const estimatedSeconds = pendingMessages / 25;
    return estimatedSeconds / 60;
  }

  /**
   * Log key metrics periodically
   */
  private static logKeyMetrics(metrics: FairProcessorMetrics): void {
    logInfo("Fair processor metrics", {
      accountLimitUtilization: `${metrics.accountLimitUtilization.toFixed(1)}%`,
      businessesActive: metrics.businessesActive,
      averageMessagesPerSecond: metrics.averageMessagesPerSecond.toFixed(2),
      fairnessIndex: metrics.fairnessIndex.toFixed(3),
      queueBacklogMinutes: metrics.queueBacklogMinutes.toFixed(1),
      errorRate: `${(metrics.errorRate * 100).toFixed(2)}%`,
      suppressionRate: `${(metrics.suppressionRate * 100).toFixed(2)}%`,
    });
  }

  /**
   * Check for performance alerts
   */
  private static checkAlerts(metrics: FairProcessorMetrics): void {
    // Alert: High account limit utilization
    if (metrics.accountLimitUtilization > 90) {
      logError("ALERT: High Twilio account limit utilization", {
        utilization: `${metrics.accountLimitUtilization.toFixed(1)}%`,
        recommendation:
          "Consider upgrading account MPS limit or implementing additional throttling",
      });
    }

    // Alert: Poor fairness
    if (metrics.fairnessIndex < 0.7 && metrics.businessesActive > 1) {
      logError("ALERT: Poor fairness in message distribution", {
        fairnessIndex: metrics.fairnessIndex.toFixed(3),
        businessesActive: metrics.businessesActive,
        recommendation: "Check fair processor algorithm for potential issues",
      });
    }

    // Alert: High error rate
    if (metrics.errorRate > 0.05) {
      // 5% error rate
      logError("ALERT: High message failure rate", {
        errorRate: `${(metrics.errorRate * 100).toFixed(2)}%`,
        recommendation: "Investigate message sending failures",
      });
    }

    // Alert: Large queue backlog
    if (metrics.queueBacklogMinutes > 30) {
      logError("ALERT: Large queue backlog", {
        backlogMinutes: metrics.queueBacklogMinutes.toFixed(1),
        recommendation:
          "Consider increasing processing frequency or investigating bottlenecks",
      });
    }
  }

  /**
   * Update business-specific metrics
   */
  static updateBusinessMetrics(
    businessId: number,
    messagesProcessed: number,
    processingTimeMs: number,
    successCount: number
  ): void {
    const existing = this.businessMetrics.get(businessId);

    this.businessMetrics.set(businessId, {
      businessId,
      messagesProcessed: (existing?.messagesProcessed || 0) + messagesProcessed,
      averageWaitTimeMs: processingTimeMs, // Simplified for now
      successRate: messagesProcessed > 0 ? successCount / messagesProcessed : 0,
      lastProcessedAt: new Date(),
    });
  }

  /**
   * Get current metrics
   */
  static getCurrentMetrics(): FairProcessorMetrics | null {
    return this.metrics.length > 0
      ? this.metrics[this.metrics.length - 1]
      : null;
  }

  /**
   * Get metrics history
   */
  static getMetricsHistory(hoursBack: number = 24): FairProcessorMetrics[] {
    const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
    return this.metrics.filter((m) => m.timestamp >= cutoff);
  }

  /**
   * Get business-specific metrics
   */
  static getBusinessMetrics(): BusinessMetrics[] {
    return Array.from(this.businessMetrics.values());
  }

  /**
   * Clear metrics history (for testing)
   */
  static clearMetrics(): void {
    this.metrics = [];
    this.businessMetrics.clear();
    logInfo("Fair processor metrics cleared");
  }

  /**
   * Get monitoring status
   */
  static getStatus() {
    return {
      isMonitoring: this.isMonitoring,
      metricsCount: this.metrics.length,
      businessesTracked: this.businessMetrics.size,
      lastCollectedAt:
        this.metrics.length > 0
          ? this.metrics[this.metrics.length - 1].timestamp
          : null,
    };
  }
}
