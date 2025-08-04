import { Router } from "express";
import { FairProcessorMonitor } from "../../services/fair-processor-monitor.js";
import { FairRateLimitedProcessor } from "../../services/fair-rate-limited-processor.js";
import { MessageQueueService } from "../../services/message-queue.js";
import { logInfo, logError } from "../../utils/logger.util.js";

const router = Router();

/**
 * GET /api/metrics/fair-processor/current
 * Get current fair processor metrics
 */
router.get("/current", async (req, res) => {
  try {
    const currentMetrics = FairProcessorMonitor.getCurrentMetrics();
    const queueStatus = FairRateLimitedProcessor.getQueueStatus();
    const processorStats = FairRateLimitedProcessor.getStats();

    res.json({
      success: true,
      data: {
        currentMetrics,
        queueStatus,
        processorStats,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    logError("Failed to get current fair processor metrics", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: "Failed to retrieve metrics",
    });
  }
});

/**
 * GET /api/metrics/fair-processor/history
 * Get fair processor metrics history
 */
router.get("/history", async (req, res) => {
  try {
    const hoursBack = parseInt(req.query.hours as string) || 24;
    const history = FairProcessorMonitor.getMetricsHistory(hoursBack);

    res.json({
      success: true,
      data: {
        history,
        hoursBack,
        totalDataPoints: history.length,
      },
    });
  } catch (error) {
    logError("Failed to get fair processor metrics history", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: "Failed to retrieve metrics history",
    });
  }
});

/**
 * GET /api/metrics/fair-processor/businesses
 * Get business-specific metrics
 */
router.get("/businesses", async (req, res) => {
  try {
    const businessMetrics = FairProcessorMonitor.getBusinessMetrics();

    res.json({
      success: true,
      data: {
        businessMetrics,
        totalBusinesses: businessMetrics.length,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    logError("Failed to get business metrics", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: "Failed to retrieve business metrics",
    });
  }
});

/**
 * GET /api/metrics/fair-processor/health
 * Get system health summary
 */
router.get("/health", async (req, res) => {
  try {
    const currentMetrics = FairProcessorMonitor.getCurrentMetrics();
    const monitoringStatus = FairProcessorMonitor.getStatus();
    const queueStats = await MessageQueueService.getQueueStats();

    // Determine overall health status
    let healthStatus = "healthy";
    const alerts = [];

    if (currentMetrics) {
      if (currentMetrics.accountLimitUtilization > 90) {
        healthStatus = "warning";
        alerts.push("High account limit utilization");
      }
      if (currentMetrics.errorRate > 0.05) {
        healthStatus = "critical";
        alerts.push("High error rate");
      }
      if (currentMetrics.queueBacklogMinutes > 30) {
        healthStatus =
          currentMetrics.queueBacklogMinutes > 60 ? "critical" : "warning";
        alerts.push("Large queue backlog");
      }
      if (
        currentMetrics.fairnessIndex < 0.7 &&
        currentMetrics.businessesActive > 1
      ) {
        healthStatus = "warning";
        alerts.push("Poor fairness distribution");
      }
    }

    res.json({
      success: true,
      data: {
        healthStatus,
        alerts,
        currentMetrics: currentMetrics
          ? {
              accountLimitUtilization: currentMetrics.accountLimitUtilization,
              businessesActive: currentMetrics.businessesActive,
              errorRate: currentMetrics.errorRate,
              queueBacklogMinutes: currentMetrics.queueBacklogMinutes,
              fairnessIndex: currentMetrics.fairnessIndex,
            }
          : null,
        queueStats,
        monitoringStatus,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    logError("Failed to get fair processor health", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: "Failed to retrieve health status",
    });
  }
});

/**
 * GET /api/metrics/fair-processor/dashboard
 * Get comprehensive dashboard data
 */
router.get("/dashboard", async (req, res) => {
  try {
    const currentMetrics = FairProcessorMonitor.getCurrentMetrics();
    const businessMetrics = FairProcessorMonitor.getBusinessMetrics();
    const queueStatus = FairRateLimitedProcessor.getQueueStatus();
    const processorStats = FairRateLimitedProcessor.getStats();
    const queueStats = await MessageQueueService.getQueueStats();
    const recentHistory = FairProcessorMonitor.getMetricsHistory(1); // Last hour

    res.json({
      success: true,
      data: {
        summary: {
          accountLimitUtilization: currentMetrics?.accountLimitUtilization || 0,
          businessesActive: currentMetrics?.businessesActive || 0,
          messagesInQueue: queueStatus.totalMessages,
          queueBacklogMinutes: currentMetrics?.queueBacklogMinutes || 0,
        },
        performance: {
          averageMessagesPerSecond:
            currentMetrics?.averageMessagesPerSecond || 0,
          peakMessagesPerSecond: currentMetrics?.peakMessagesPerSecond || 0,
          averageProcessingTimeMs: currentMetrics?.averageProcessingTimeMs || 0,
          fairnessIndex: currentMetrics?.fairnessIndex || 1,
        },
        health: {
          errorRate: currentMetrics?.errorRate || 0,
          suppressionRate: currentMetrics?.suppressionRate || 0,
          queueStats,
        },
        businesses: businessMetrics.slice(0, 10), // Top 10 businesses
        recentTrends: recentHistory.map((h) => ({
          timestamp: h.timestamp,
          accountLimitUtilization: h.accountLimitUtilization,
          averageMessagesPerSecond: h.averageMessagesPerSecond,
          businessesActive: h.businessesActive,
        })),
        timestamp: new Date(),
      },
    });
  } catch (error) {
    logError("Failed to get dashboard data", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: "Failed to retrieve dashboard data",
    });
  }
});

/**
 * POST /api/metrics/fair-processor/clear
 * Clear metrics history (admin only)
 */
router.post("/clear", async (req, res) => {
  try {
    FairProcessorMonitor.clearMetrics();

    logInfo("Fair processor metrics cleared by admin", {
      userAgent: req.headers["user-agent"],
      ip: req.ip,
    });

    res.json({
      success: true,
      message: "Metrics history cleared successfully",
      timestamp: new Date(),
    });
  } catch (error) {
    logError("Failed to clear metrics", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: "Failed to clear metrics",
    });
  }
});

export default router;
