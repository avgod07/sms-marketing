import type { Express } from "express";
import { createServer, type Server } from "http";
import { registerAuthRoutes } from "./modules/auth";
import { registerTwilioRoutes } from "./modules/twilio";
import { registerPublicRoutes } from "./modules/public";
import { registerBusinessRoutes } from "./modules/business";

import { registerContactRoutes } from "./modules/contacts";
import { registerCampaignRoutes } from "./modules/campaigns";
import { registerCouponRoutes } from "./modules/coupons";
import { registerMessageRoutes } from "./modules/messages";
import { registerCreditsRoutes } from "./modules/credits";
import { registerSubscriptionRoutes } from "./modules/subscriptions";
import { registerKeywordRoutes } from "./modules/keywords";

export async function registerRoutes(app: Express): Promise<Server> {
  registerAuthRoutes(app);
  registerTwilioRoutes(app);
  registerPublicRoutes(app);
  registerBusinessRoutes(app);

  registerContactRoutes(app);
  registerCampaignRoutes(app);
  registerCouponRoutes(app);
  registerMessageRoutes(app);
  registerCreditsRoutes(app);
  registerSubscriptionRoutes(app);
  registerKeywordRoutes(app);

  const httpServer = createServer(app);
  return httpServer;
}
