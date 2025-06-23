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
    let user = await storage.getUserByClerkId(userId);
    if (!user) {
      const business = await storage.createBusiness({ name: "Your Business" });
      user = await storage.forBusiness(business.id).createUser({
        username: userId,
        passwordHash: "",
        clerkUserId: userId,
      });
    }

    (req as any).user = user;
    next();
  } catch (err) {
    next(err);
  }
}
