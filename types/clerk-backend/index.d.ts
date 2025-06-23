declare module "@clerk/backend" {
  import type { RequestHandler, Request } from "express";
  export interface Auth {
    userId?: string | null;
  }
  export const clerkExpressWithAuth: () => RequestHandler;
  export const getAuth: (req: Request) => Auth;
}
