import type { Express, Request, Response, NextFunction } from "express";
import { clerkExpressRequireAuth, getAuth } from "../utils/clerk-auth";
import { storage } from "../db/storage";

/**
 * Configure authentication middleware.
 *
 * The login page and other static assets should be accessible without
 * authentication. Only API routes need to enforce Clerk auth, so we
 * mount the Clerk middleware on the "/api" path prefix.
 */
export function setupAuth(app: Express) {
  app.use("/api", clerkExpressRequireAuth());
}

export async function ensureAuthenticated(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const { userId } = await getAuth(req);
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  try {
    let user = await storage.getUserByClerkId(userId);
    if (!user) {
      user = await storage.provisionUserWithBusiness(userId);
    }

    (req as any).user = user;
    next();
  } catch (err) {
    next(err);
  }
}
