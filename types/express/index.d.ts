import type { User, Coupon } from "@shared/schema";

declare global {
  namespace Express {
    interface Request {
      user?: User;
      coupon?: Coupon;
    }
  }
}

export {};
