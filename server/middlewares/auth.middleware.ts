import type { Express, Request, Response, NextFunction } from "express";
import { clerkClient } from "@clerk/express";
import { getAuth } from "@clerk/express";
import { storage } from "../db/storage";

export function setupAuth(_app: Express) {
  // Clerk middleware is registeredd in the routes file
}

export async function ensureAuthenticated(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { userId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  let user = await storage.getUserByClerkId(userId);
  if (!user) {
    const clerkUser = await clerkClient.users.getUser(userId);
    const email =
      clerkUser?.primaryEmailAddress?.emailAddress ||
      clerkUser.emailAddresses?.[0]?.emailAddress ||
      `${userId}@example.com`;
    const defaultBusinessName = email.split("@")[0] || "Untitled";
    const business = await storage.createBusiness({
      name: defaultBusinessName,
    });
    user = await storage
      .forBusiness(business.id)
      .createUser({ username: email, passwordHash: "", clerkId: userId });
  }

  (req as any).user = user;
  next();
}
