import type { Express } from "express";
import { requireAuth } from "@clerk/express";
import { getBizForRequest } from "./utils";
import { logError } from "../../utils/logger.util";

export function registerAnalyticsRoutes(app: Express) {
  app.get("/api/analytics", requireAuth(), async (req, res) => {
    try {
      const { biz } = await getBizForRequest(req);
      const { range } = req.query as { range?: string };
      if (!range || !["thisMonth", "lastMonth", "thisWeek", "lastWeek"].includes(range)) {
        return res.status(400).json({ message: "Invalid range" });
      }
      const analytics = await biz.getAnalytics(range as any);
      res.json(analytics);
    } catch (error) {
      logError("Error fetching analytics:", error);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });
}
