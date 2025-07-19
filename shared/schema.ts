import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  timestamp,
  varchar,
  decimal,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const businesses = pgTable("businesses", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  plan: text("plan").notNull().default("trial"), // 'trial', 'starter'
  trialEndsAt: timestamp("trial_ends_at"),
  stripeCustomerId: varchar("stripe_customer_id", { length: 64 }),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 64 }),
  initialMessage: text("initial_message"),
  messagingServiceSid: varchar("messaging_service_sid", { length: 64 }),
  onboardingComplete: boolean("onboarding_complete").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const contacts = pgTable(
  "contacts",
  {
    id: serial("id").primaryKey(),
    businessId: integer("business_id")
      .references(() => businesses.id)
      .notNull(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    phoneNumber: varchar("phone_number", { length: 20 }).notNull(),
    email: text("email"),
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    // Business-scoped unique constraint: same phone number can exist across businesses
    // but not within the same business
    businessPhoneUnique: uniqueIndex(
      "contacts_business_id_phone_number_idx"
    ).on(table.businessId, table.phoneNumber),
    // Performance index for phone number lookups within a business
    businessPhoneLookup: index(
      "contacts_business_id_phone_number_lookup_idx"
    ).on(table.businessId, table.phoneNumber),
  })
);

export const campaigns = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id")
    .references(() => businesses.id)
    .notNull(),
  name: text("name").notNull(),
  message: text("message").notNull(),
  mediaUrl: text("media_url"),
  status: text("status").notNull().default("in_progress"), // in_progress, completed
  sentCount: integer("sent_count").default(0),
  deliveredCount: integer("delivered_count").default(0),
  clickCount: integer("click_count").default(0),
  scheduledAt: timestamp("scheduled_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const messages = pgTable(
  "messages",
  {
    id: serial("id").primaryKey(),
    businessId: integer("business_id")
      .references(() => businesses.id)
      .notNull(),
    campaignId: integer("campaign_id").references(() => campaigns.id, {
      onDelete: "cascade",
    }),
    contactId: integer("contact_id").references(() => contacts.id),
    content: text("content").notNull(),
    phoneNumber: varchar("phone_number", { length: 20 }).notNull(),
    status: text("status").notNull().default("pending"), // pending, sent, delivered, failed
    messageType: text("message_type").notNull().default("regular"), // initial, campaign, regular, received, test
    billingStatus: text("billing_status").notNull().default("success"), // success, failed
    messageSid: varchar("message_sid", { length: 64 }),
    errorCode: integer("error_code"),
    sentAt: timestamp("sent_at", { mode: "string" }),
    deliveredAt: timestamp("delivered_at", { mode: "string" }),
    createdAt: timestamp("created_at", { mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("messages_delivered_at_idx").using(
      "btree",
      table.deliveredAt.asc().nullsLast().op("timestamp_ops")
    ),
    index("messages_contact_id_idx").using("btree", table.contactId),
    index("messages_business_id_idx").using("btree", table.businessId),
    index("messages_campaign_id_idx").using("btree", table.campaignId),
    index("messages_message_type_idx").using("btree", table.messageType),
    index("messages_billing_status_idx").using("btree", table.billingStatus),
  ]
);

export const coupons = pgTable(
  "coupons",
  {
    id: serial("id").primaryKey(),
    businessId: integer("business_id")
      .references(() => businesses.id)
      .notNull(),
    code: text("code").notNull(),
    label: text("label"),
    type: text("type").notNull(), // percent, amount
    value: decimal("value", { precision: 10, scale: 2 }).notNull(),
    usageCount: integer("usage_count").default(0),
    expirationDate: timestamp("expiration_date"),
    validDays: integer("valid_days"),
    status: text("status").notNull().default("active"), // active, expired, disabled
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    codeIdx: uniqueIndex("coupons_business_id_code_idx").on(
      table.businessId,
      table.code
    ),
  })
);

export const couponRedemptions = pgTable("coupon_redemptions", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id")
    .references(() => businesses.id)
    .notNull(),
  couponId: integer("coupon_id")
    .references(() => coupons.id)
    .notNull(),
  contactId: integer("contact_id").references(() => contacts.id),
  phoneNumber: varchar("phone_number", { length: 20 }),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const couponRecipients = pgTable("coupon_recipients", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id")
    .references(() => businesses.id)
    .notNull(),
  couponId: integer("coupon_id")
    .references(() => coupons.id)
    .notNull(),
  campaignId: integer("campaign_id")
    .references(() => campaigns.id, { onDelete: "cascade" })
    .notNull(),
  contactId: integer("contact_id")
    .references(() => contacts.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const analytics = pgTable("analytics", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id")
    .references(() => businesses.id)
    .notNull(),
  date: timestamp("date").defaultNow().notNull(),
  totalContacts: integer("total_contacts").default(0),
  messagesSent: integer("messages_sent").default(0),
  deliveryRate: decimal("delivery_rate", { precision: 5, scale: 2 }).default(
    "0.00"
  ),
  clickRate: decimal("click_rate", { precision: 5, scale: 2 }).default("0.00"),
});

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    businessId: integer("business_id")
      .references(() => businesses.id)
      .notNull(),
    username: text("username").notNull(),
    passwordHash: text("password_hash").notNull(),
    clerkId: varchar("clerk_id", { length: 64 }).unique(),
    onboardingComplete: boolean("onboarding_complete").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    // Business-scoped unique constraint: same username can exist across businesses
    // but not within the same business
    businessUsernameUnique: uniqueIndex("users_business_id_username_idx").on(
      table.businessId,
      table.username
    ),
    // Performance index for username lookups within a business
    businessUsernameLookup: index("users_business_id_username_lookup_idx").on(
      table.businessId,
      table.username
    ),
  })
);

export const businessProfiles = pgTable("business_profiles", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id")
    .references(() => businesses.id)
    .notNull()
    .unique(),
  addressStreet: text("address_street").notNull(),
  addressCity: text("address_city").notNull(),
  addressState: text("address_state").notNull(),
  addressPostalCode: text("address_postal_code").notNull(),
  addressCountry: text("address_country").notNull(),
  organizationType: text("organization_type").notNull(),
  companyStatus: text("company_status").notNull(),
  stockTicker: text("stock_ticker"),
  taxId: text("tax_id").notNull(),
  industrySector: text("industry_sector").notNull(),
  regionsOfOperation: text("regions_of_operation").notNull(),
  repName: text("rep_name").notNull(),
  repTitle: text("rep_title").notNull(),
  repEmail: text("rep_email").notNull(),
  repPhone: varchar("rep_phone", { length: 20 }).notNull(),
  useCase: text("use_case").notNull(),
  campaignDescription: text("campaign_description").notNull(),
  sample1: text("sample1").notNull(),
  sample2: text("sample2").notNull(),
  status: text("status").default("provided").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const twilioCredentials = pgTable("twilio_credentials", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id")
    .references(() => businesses.id)
    .notNull()
    .unique(),
  accountSid: varchar("account_sid", { length: 64 }).notNull(),
  messagingServiceSid: varchar("messaging_service_sid", { length: 64 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const businessPhoneNumbers = pgTable("business_phone_numbers", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id")
    .references(() => businesses.id)
    .notNull(),
  phoneNumber: varchar("phone_number", { length: 20 }).notNull(),
  isDefault: boolean("is_default").default(false).notNull(),
  phoneSid: varchar("phone_sid", { length: 64 }),
  serviceSid: varchar("service_sid", { length: 64 }),
  assignmentStatus: text("assignment_status"),
  tfvSid: varchar("tfv_sid", { length: 64 }),
  verificationStatus: text("verification_status").default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const messagingConfigs = pgTable("messaging_config", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id")
    .references(() => businesses.id)
    .notNull()
    .unique(),
  useCases: text("use_cases").array().notNull(),
  volume: text("volume").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const businessCredits = pgTable("business_credits", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id")
    .references(() => businesses.id)
    .notNull()
    .unique(),
  balance: integer("balance").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const creditTransactions = pgTable("credit_transactions", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id")
    .references(() => businesses.id)
    .notNull(),
  type: text("type").notNull(), // 'purchase', 'sms_sent', 'refund', 'adjustment'
  amount: integer("amount").notNull(), // positive for credits added, negative for credits used
  description: text("description"),
  metadata: text("metadata"), // JSON string for storing additional data
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const onboardingProgress = pgTable("onboarding_progress", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id")
    .references(() => businesses.id)
    .notNull()
    .unique(),
  step: integer("step").notNull().default(1),

  // Step 1: Basic Business Info (from business info form)
  businessName: text("business_name"),
  websiteUrl: text("website_url"),
  address1: text("address1"),
  address2: text("address2"),
  city: text("city"),
  state: text("state"),
  postalCode: text("postal_code"),
  country: text("country"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  email: text("email"),
  phoneNumber: text("phone_number"),

  // Step 2: Monthly Volume (for A2P)
  monthlyVolume: text("monthly_volume"),

  // Step 3: Use Cases (for A2P)
  useCases: text("use_cases").array(),

  // Step 4: Initial Message
  initialMessage: text("initial_message"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const subscriptionPlans = pgTable("subscription_plans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // 'starter'
  displayName: text("display_name").notNull(), // 'Starter Plan'
  priceId: varchar("price_id", { length: 64 }).notNull(), // Stripe Price ID
  priceMonthly: integer("price_monthly").notNull(), // Price in cents
  priceYearly: integer("price_yearly").notNull(), // Price in cents for annual billing
  features: text("features").array(), // Array of feature descriptions
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const subscriptionEvents = pgTable("subscription_events", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id")
    .references(() => businesses.id)
    .notNull(),
  eventType: text("event_type").notNull(), // 'subscription_created', 'subscription_updated', 'subscription_cancelled', etc.
  stripeEventId: varchar("stripe_event_id", { length: 64 }),
  metadata: text("metadata"), // JSON string for additional data
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const contactsRelations = relations(contacts, ({ many }) => ({
  messages: many(messages),
}));

export const campaignsRelations = relations(campaigns, ({ many }) => ({
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  contact: one(contacts, {
    fields: [messages.contactId],
    references: [contacts.id],
  }),
  campaign: one(campaigns, {
    fields: [messages.campaignId],
    references: [campaigns.id],
  }),
}));

export const businessesRelations = relations(businesses, ({ many }) => ({
  users: many(users),
  contacts: many(contacts),
  campaigns: many(campaigns),
  messages: many(messages),
  coupons: many(coupons),
  couponRedemptions: many(couponRedemptions),
  couponRecipients: many(couponRecipients),
  analytics: many(analytics),
  businessProfiles: many(businessProfiles),
  twilioCredentials: many(twilioCredentials),
  phoneNumbers: many(businessPhoneNumbers),
  messagingConfig: many(messagingConfigs),
  businessCredits: many(businessCredits),
  creditTransactions: many(creditTransactions),
  onboardingProgress: many(onboardingProgress),
  subscriptionEvents: many(subscriptionEvents),
}));

// Insert schemas
export const insertContactSchema = createInsertSchema(contacts).omit({
  id: true,
  businessId: true,
  createdAt: true,
  updatedAt: true,
  active: true,
});

export const insertCampaignSchema = createInsertSchema(campaigns).omit({
  id: true,
  businessId: true,
  createdAt: true,
  updatedAt: true,
  sentCount: true,
  deliveredCount: true,
  clickCount: true,
});

export const insertMessageSchema = createInsertSchema(messages)
  .omit({
    id: true,
    businessId: true,
    createdAt: true,
    sentAt: true,
    deliveredAt: true,
  })
  .partial({ messageSid: true, errorCode: true });

export const insertCouponSchema = createInsertSchema(coupons).omit({
  id: true,
  businessId: true,
  createdAt: true,
  updatedAt: true,
  usageCount: true,
});

export const insertCouponRedemptionSchema = createInsertSchema(
  couponRedemptions
).omit({
  id: true,
  businessId: true,
  createdAt: true,
});

export const insertCouponRecipientSchema = createInsertSchema(
  couponRecipients
).omit({
  id: true,
  businessId: true,
  createdAt: true,
});

export const insertBusinessSchema = createInsertSchema(businesses).omit({
  id: true,
  createdAt: true,
});

export const insertBusinessProfileSchema = createInsertSchema(
  businessProfiles
).omit({
  id: true,
  businessId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTwilioCredentialSchema = createInsertSchema(
  twilioCredentials
).omit({
  id: true,
  businessId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBusinessPhoneNumberSchema = createInsertSchema(
  businessPhoneNumbers
).omit({
  id: true,
  businessId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMessagingConfigSchema = createInsertSchema(
  messagingConfigs
).omit({
  id: true,
  businessId: true,
  createdAt: true,
  updatedAt: true,
});

// Legacy alias for backward compatibility
export const insertTwilioA2pConfigSchema = insertMessagingConfigSchema;

export const insertUserSchema = createInsertSchema(users)
  .omit({
    id: true,
    businessId: true,
    createdAt: true,
  })
  .partial({ clerkId: true });

export const insertBusinessCreditSchema = createInsertSchema(
  businessCredits
).omit({
  id: true,
  businessId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCreditTransactionSchema = createInsertSchema(
  creditTransactions
).omit({
  id: true,
  businessId: true,
  createdAt: true,
});

export const insertOnboardingProgressSchema = createInsertSchema(
  onboardingProgress
).omit({
  id: true,
  businessId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSubscriptionPlanSchema = createInsertSchema(
  subscriptionPlans
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSubscriptionEventSchema = createInsertSchema(
  subscriptionEvents
).omit({
  id: true,
  businessId: true,
  createdAt: true,
});

// Types
export type Contact = typeof contacts.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;

export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type CampaignStatus = "in_progress" | "completed" | "failed";

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

export type Coupon = typeof coupons.$inferSelect;
export type InsertCoupon = z.infer<typeof insertCouponSchema>;

export type CouponRedemption = typeof couponRedemptions.$inferSelect;
export type InsertCouponRedemption = z.infer<
  typeof insertCouponRedemptionSchema
>;

export type CouponRecipient = typeof couponRecipients.$inferSelect;
export type InsertCouponRecipient = z.infer<typeof insertCouponRecipientSchema>;

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Analytics = typeof analytics.$inferSelect;

export type Business = typeof businesses.$inferSelect;
export type InsertBusiness = typeof businesses.$inferInsert;

export type BusinessProfile = typeof businessProfiles.$inferSelect;
export type InsertBusinessProfile = z.infer<typeof insertBusinessProfileSchema>;

export type TwilioCredential = typeof twilioCredentials.$inferSelect;
export type InsertTwilioCredential = z.infer<
  typeof insertTwilioCredentialSchema
>;

export type BusinessPhoneNumber = typeof businessPhoneNumbers.$inferSelect;
export type InsertBusinessPhoneNumber = z.infer<
  typeof insertBusinessPhoneNumberSchema
>;

export type MessagingConfig = typeof messagingConfigs.$inferSelect;
export type InsertMessagingConfig = z.infer<typeof insertMessagingConfigSchema>;

// Legacy aliases for backward compatibility during transition
export type TwilioA2pConfig = MessagingConfig;
export type InsertTwilioA2pConfig = InsertMessagingConfig;

export type BusinessCredit = typeof businessCredits.$inferSelect;
export type InsertBusinessCredit = z.infer<typeof insertBusinessCreditSchema>;

export type CreditTransaction = typeof creditTransactions.$inferSelect;
export type InsertCreditTransaction = z.infer<
  typeof insertCreditTransactionSchema
>;

export type OnboardingProgress = typeof onboardingProgress.$inferSelect;
export type InsertOnboardingProgress = z.infer<
  typeof insertOnboardingProgressSchema
>;

export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type InsertSubscriptionPlan = typeof subscriptionPlans.$inferInsert;

export type SubscriptionEvent = typeof subscriptionEvents.$inferSelect;
export type InsertSubscriptionEvent = typeof subscriptionEvents.$inferInsert;
