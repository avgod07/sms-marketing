import type { Request, Response, NextFunction } from "express";

interface Attempt {
  timestamps: number[];
}

export function createRateLimiter(options: { windowMs: number; max: number }) {
  const { windowMs, max } = options;
  const attempts = new Map<string, Attempt>();

  return function rateLimiter(req: Request, res: Response, next: NextFunction) {
    const userId = (req as any).user?.id || "anonymous";
    const code = req.params.code || "global";
    const key = `${userId}:${code}`;
    const now = Date.now();
    const attempt = attempts.get(key) || { timestamps: [] };
    attempt.timestamps = attempt.timestamps.filter((ts) => now - ts < windowMs);
    if (attempt.timestamps.length >= max) {
      return res
        .status(429)
        .json({
          message: "Too many redemption attempts. Please try again later.",
        });
    }
    attempt.timestamps.push(now);
    attempts.set(key, attempt);
    next();
  };
}
