import type { Express } from "express";
import { requireAuth } from "@clerk/express";
import { storage } from "../../db/storage";
import { logError, logInfo } from "../../utils/logger.util";

export function registerAuthRoutes(app: Express) {
  // Simple endpoint to create local user for Clerk users
  app.post("/api/auth/setup", requireAuth(), async (req, res) => {
    try {
      const clerkAuth =
        typeof (req as any).auth === "function" ? (req as any).auth() : (req as any).auth;
      const clerkUserId = clerkAuth?.userId;
      if (!clerkUserId) {
        return res.status(400).json({ message: "No Clerk user ID found" });
      }

      let user = await storage.getUserByClerkId(clerkUserId);
      if (user) {
        return res.json({ message: "User already exists", userId: user.id });
      }

      const business = await storage.createBusiness({
        name: `Business for ${clerkUserId.slice(0, 8)}`,
      });

      user = await storage.forBusiness(business.id).createUser({
        username: `user_${clerkUserId.slice(0, 8)}`,
        passwordHash: "",
        clerkId: clerkUserId,
      });

      logInfo(`Created local user for Clerk user ${clerkUserId}`, {
        userId: user.id,
        businessId: business.id,
      });
      res.json({
        message: "User created successfully",
        userId: user.id,
        businessId: business.id,
      });
    } catch (error) {
      logError("Error setting up user:", error);
      res.status(500).json({ message: "Failed to setup user" });
    }
  });

  // Authentication routes handled by Clerk
  app.get("/api/me", requireAuth(), async (req, res) => {
    try {
      const auth =
        typeof (req as any).auth === "function" ? (req as any).auth() : (req as any).auth;

      if (!auth?.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = await storage.getUserByClerkId(auth.userId);

      res.json({
        ...auth,
        hasLocalAccount: !!user,
        userId: user?.id,
        businessId: user?.businessId,
      });
    } catch (error) {
      logError("Error in /api/me:", error);
      res.status(500).json({ message: "Failed to get user info" });
    }
  });
}
