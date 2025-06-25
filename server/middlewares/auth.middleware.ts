import type { Express, Request, Response, NextFunction } from "express";
import { requireAuth } from "@clerk/express";

export function setupAuth(app: Express) {
  // Register Clerk middleware globally if needed
  // app.use(requireAuth());
}

export const ensureAuthenticated = requireAuth();
