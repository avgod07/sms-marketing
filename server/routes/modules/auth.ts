import type { Express } from "express";
import { requireAuth } from "@clerk/express";
import { storage } from "../../db/storage";
import { logError, logInfo } from "../../utils/logger.util";

export function registerAuthRoutes(app: Express) {
  // Simple endpoint to create local user for Clerk users
  app.post("/api/auth/setup", requireAuth(), async (req, res) => {
    try {
      const clerkAuth =
        typeof (req as any).auth === "function"
          ? (req as any).auth()
          : (req as any).auth;
      const clerkUserId = clerkAuth?.userId;
      if (!clerkUserId) {
        return res.status(400).json({ message: "No Clerk user ID found" });
      }

      // Check if user already exists first (race condition protection)
      let user = await storage.getUserByClerkId(clerkUserId);
      if (user) {
        logInfo(`User already exists for Clerk user ${clerkUserId}`, {
          userId: user.id,
          businessId: user.businessId,
        });
        return res.json({
          message: "User already exists",
          userId: user.id,
          businessId: user.businessId,
          created: false,
        });
      }

      try {
        // Create business with default free_trial plan
        const business = await storage.createBusiness({
          name: `Business for ${clerkUserId.slice(0, 8)}`,
        });

        // Create user
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
          created: true,
        });
      } catch (createError: any) {
        // Handle race condition where user was created between our check and creation
        if (
          createError.code === "23505" &&
          createError.constraint === "users_clerk_id_unique"
        ) {
          // Another request created the user, fetch and return it
          const existingUser = await storage.getUserByClerkId(clerkUserId);
          if (existingUser) {
            logInfo(
              `Race condition resolved: User created by concurrent request for Clerk user ${clerkUserId}`,
              {
                userId: existingUser.id,
                businessId: existingUser.businessId,
              }
            );
            return res.json({
              message: "User already exists",
              userId: existingUser.id,
              businessId: existingUser.businessId,
              created: false,
            });
          }
        }
        throw createError; // Re-throw if not the expected constraint error
      }
    } catch (error) {
      logError("Error setting up user:", error);
      res.status(500).json({ message: "Failed to setup user" });
    }
  });

  // Authentication routes handled by Clerk
  app.get("/api/me", requireAuth(), async (req, res) => {
    try {
      const auth =
        typeof (req as any).auth === "function"
          ? (req as any).auth()
          : (req as any).auth;

      if (!auth?.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = await storage.getUserByClerkId(auth.userId);

      if (!user) {
        return res.json({
          ...auth,
          hasLocalAccount: false,
        });
      }

      // Refresh TFV status from Twilio on login
      try {
        const biz = storage.forBusiness(user.businessId);
        await biz.refreshTFVStatusFromTwilio();

        // Get current TFV status to include in response
        const tfvStatus = await biz.getTFVVerificationStatus();

        logInfo("TFV status refreshed on login", {
          userId: user.id,
          businessId: user.businessId,
          tfvStatus: tfvStatus.status,
          isVerified: tfvStatus.isVerified,
        });

        res.json({
          ...auth,
          hasLocalAccount: !!user,
          userId: user?.id,
          businessId: user?.businessId,
          tfvStatus: {
            isVerified: tfvStatus.isVerified,
            status: tfvStatus.status,
            hasPhoneNumbers: tfvStatus.hasPhoneNumbers,
          },
        });
      } catch (tfvError) {
        // Don't fail login if TFV refresh fails, just log the error
        logError("Failed to refresh TFV status on login:", tfvError);

        res.json({
          ...auth,
          hasLocalAccount: !!user,
          userId: user?.id,
          businessId: user?.businessId,
          tfvStatus: {
            isVerified: false,
            status: "unknown",
            hasPhoneNumbers: false,
          },
        });
      }
    } catch (error) {
      logError("Error in /api/me:", error);
      res.status(500).json({ message: "Failed to get user info" });
    }
  });
}
