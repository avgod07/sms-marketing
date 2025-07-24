import { storage } from "../../db/storage";
import { logError, logInfo } from "../../utils/logger.util";
import { insertBusinessProfileSchema } from "@shared/schema";
import { z } from "zod";

export const businessProfileSchema = insertBusinessProfileSchema.extend({
  name: z.string().optional(),
});

export const simpleCampaignSchema = z.object({
  name: z.string().min(1, { message: "Campaign name is required" }),
  message: z
    .string()
    .min(1, { message: "Message is required" })
    .max(1600, {
      message: "Message exceeds maximum length of 1600 characters",
    }),
  mediaUrl: z.string().url().optional().or(z.literal("")).optional(),
});

export const volumeOptions = [
  "Less than 1K",
  "1K to 10K",
  "10K to 100K",
  "100K to 500K",
  "500K to 1M",
  "More than 1M+",
] as const;

export const a2pConfigSchema = z.object({
  volume: z.enum(volumeOptions),
  useCases: z.array(z.string()).min(1),
});

export async function getBizForRequest(req: any) {
  const clerkAuth = typeof req.auth === "function" ? req.auth() : req.auth;
  const clerkUserId = clerkAuth?.userId;
  if (!clerkUserId) throw new Error("No Clerk user ID found in request");

  let user = await storage.getUserByClerkId(clerkUserId);

  if (!user) {
    // User should be created through /api/auth/setup endpoint first
    throw new Error("User not found. Please complete account setup first.");
  }

  return { biz: storage.forBusiness(user.businessId), user };
}

export function logDetailedError(context: string, error: any) {
  if (error instanceof Error) {
    logError(`${context}: ${error.message}\n${error.stack}`);
  } else {
    logError(`${context}:`, error);
  }
}
