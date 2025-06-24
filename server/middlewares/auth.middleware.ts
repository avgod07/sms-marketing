import type { Express, Request, Response, NextFunction } from "express";
import { clerkExpressRequireAuth, getAuth } from "../utils/clerk-auth";
import { storage } from "../db/storage";
import { logDebug, logInfo, logWarn, logError } from "../utils/logger.util";

/**
 * Configure authentication middleware.
 *
 * The login page and other static assets should be accessible without
 * authentication. Only API routes need to enforce Clerk auth, so we
 * mount the Clerk middleware on the "/api" path prefix.
 */
export function setupAuth(app: Express) {
  logInfo("Attaching auth middleware");
  app.use("/api", clerkExpressRequireAuth());
}

export async function ensureAuthenticated(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  logDebug("ensureAuthenticated", { path: req.path });
  const { userId } = await getAuth(req);
  logDebug("getAuth", { userId });
  if (!userId) {
    logWarn("Unauthenticated request", { path: req.path });
    return res.status(401).json({ message: "Unauthorized" });
  }
  try {
    let user = await storage.getUserByClerkId(userId);
    if (!user) {
      logInfo("provisioning user", { clerkUserId: userId });
      user = await storage.provisionUserWithBusiness(userId);
    }

    (req as any).user = user;
    logDebug("authentication succeeded", { userId, id: user.id });
    next();
  } catch (err) {
    logError("authentication error", { error: err });
    next(err);
  }
}
