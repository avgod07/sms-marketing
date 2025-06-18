import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/errors";
import { logError } from "../utils/logger.util";

export function formatStack(stack?: string): string[] | undefined {
  return stack?.split("\n").map((l) => l.trim());
}

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  const status = err instanceof ApiError ? err.status : err.status || err.statusCode || 500;
  const message = err instanceof ApiError ? err.message : err.message || "Internal Server Error";
  const details = err instanceof ApiError ? err.details : undefined;
  logError(message, { stack: formatStack(err.stack), details });
  res.status(status).json({ error: { message, details } });
}

export function setupGlobalErrorHandling() {
  process.on("unhandledRejection", (reason: any) => {
    const err = reason instanceof Error ? reason : new Error(String(reason));
    logError("Unhandled Rejection", { stack: formatStack(err.stack), message: err.message });
  });
}
