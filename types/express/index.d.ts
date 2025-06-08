import type { User, Coupon } from "@shared/schema";

declare global {
  namespace Express {
    interface Request {
      login(user: User, done: (err?: any) => void): void;
      logout(done: (err?: any) => void): void;
      isAuthenticated(): boolean;
      user?: User;
      coupon?: Coupon;
    }
  }
}

export {};
