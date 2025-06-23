import type { Express, Request, Response, NextFunction } from "express";
export function setupAuth(_app: Express) {
  // Clerk authentication handled on the frontend.
}

export function ensureAuthenticated(
  _req: Request,
  _res: Response,
  next: NextFunction,
) {
  // Backend assumes authentication is handled by Clerk on the frontend.
  next();
}
