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
      return res.status(429).json({
        message: "Too many redemption attempts. Please try again later.",
      });
    }
    attempt.timestamps.push(now);
    attempts.set(key, attempt);
    next();
  };
}

// ✅ TFV-SPECIFIC RATE LIMITER (PREVENTS API FAILURES)
export function createTFVRateLimiter() {
  const tfvAttempts = new Map<string, Attempt>();
  const windowMs = 60 * 60 * 1000; // 1 hour window
  const maxAttempts = 5; // Max 5 TFV submissions per business per hour

  return function tfvRateLimiter(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    const businessId =
      (req as any).business?.id || (req as any).user?.businessId || "unknown";
    const key = `tfv:${businessId}`;
    const now = Date.now();

    const attempt = tfvAttempts.get(key) || { timestamps: [] };
    attempt.timestamps = attempt.timestamps.filter((ts) => now - ts < windowMs);

    if (attempt.timestamps.length >= maxAttempts) {
      return res.status(429).json({
        message:
          "Too many TFV submission attempts. Please wait before trying again.",
        code: "TFV_RATE_LIMITED",
        guidance:
          "TFV submissions are limited to 5 per hour per business for API stability.",
        retryAfter: Math.ceil(
          (attempt.timestamps[0] + windowMs - now) / 1000 / 60
        ), // minutes
      });
    }

    attempt.timestamps.push(now);
    tfvAttempts.set(key, attempt);
    next();
  };
}
