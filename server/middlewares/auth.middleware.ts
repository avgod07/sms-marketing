import type { Express } from "express";
import { requireAuth } from "@clerk/express";

export function setupAuth(app: Express) {
  // Do not apply requireAuth globally!
  // Only use requireAuth on /api routes or individual API endpoints.
}

export const ensureAuthenticated = requireAuth();
