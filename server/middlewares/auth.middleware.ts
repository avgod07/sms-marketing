import type { Express, Request, Response, NextFunction } from "express";
import { clerkExpressRequireAuth, getAuth } from "../utils/clerk-auth";
import { storage } from "../db/storage";

export function setupAuth(app: Express) {
  app.use(clerkExpressRequireAuth());
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
    const user = await storage.getUserByClerkId(userId);
    if (!user) {
      if (req.path.startsWith("/signup")) {
        return next();
      }
      return res.status(401).json({ message: "Unauthorized" });
    }
    (req as any).user = user;
    next();
  } catch (err) {
    next(err);
  }
}
