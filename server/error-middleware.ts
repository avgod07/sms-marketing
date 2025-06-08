import { Request, Response, NextFunction } from 'express';
import { ApiError } from './errors';
import { logError } from './logger';

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  const status = err instanceof ApiError ? err.status : err.status || err.statusCode || 500;
  const message = err instanceof ApiError ? err.message : err.message || 'Internal Server Error';
  const details = err instanceof ApiError ? err.details : undefined;
  logError(message, { stack: err.stack, details });
  res.status(status).json({ error: { message, details } });
}
