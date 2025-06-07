import type { User } from "@shared/schema";

declare module "express-session" {}

declare module "passport" {}

declare module "passport-local" {
  export const Strategy: any;
}

declare module "bcryptjs" {
  const bcrypt: any;
  export default bcrypt;
}

declare global {
  namespace Express {
    interface Request {
      login(user: User, done: (err?: any) => void): void;
      logout(done: (err?: any) => void): void;
      isAuthenticated(): boolean;
      user?: User;
    }
  }
}

export {};
