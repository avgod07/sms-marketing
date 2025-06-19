import type { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "../config/db.config";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcryptjs";
import { storage } from "../db/storage";
import type { User } from "@shared/schema";

export function setupAuth(app: Express) {
  const envSecret = process.env.SESSION_SECRET;

  if (!envSecret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SESSION_SECRET must be set in production");
    } else {
      console.warn(
        "SESSION_SECRET is not set. Using fallback secret for development.",
      );
    }
  }

  app.use(
    session({
      secret: envSecret || "secret",
      resave: false,
      saveUninitialized: false,
      store: new (connectPgSimple(session))({ pool }),
    }),
  );
  app.use(passport.initialize());
  app.use(passport.session());
}

passport.use(
  new LocalStrategy(async (username: string, password: string, done: (err: any, user?: User | false, info?: any) => void) => {
    try {
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return done(null, false, { message: "Incorrect username" });
      }
      const match = await bcrypt.compare(password, user.passwordHash);
      if (!match) {
        return done(null, false, { message: "Incorrect password" });
      }
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }),
);

passport.serializeUser((user: User, done: (err: any, id?: number) => void) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: number, done: (err: any, user?: User | null) => void) => {
  try {
    const user = await storage.getUserById(id);
    done(null, user || null);
  } catch (err) {
    done(err);
  }
});

export function ensureAuthenticated(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
}
