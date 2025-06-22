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
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id")
    .references(() => businesses.id)
    .notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phoneNumber: varchar("phone_number", { length: 20 }).notNull().unique(),
  email: text("email"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const campaigns = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id")
    .references(() => businesses.id)
    .notNull(),
  name: text("name").notNull(),
  message: text("message").notNull(),
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
    contactId: integer("contact_id")
      .references(() => contacts.id)
      .notNull(),
    content: text("content").notNull(),
    phoneNumber: varchar("phone_number", { length: 20 }).notNull(),
    status: text("status").notNull().default("pending"), // pending, sent, delivered, failed
    messageSid: varchar("message_sid", { length: 64 }),
    errorCode: integer("error_code"),
    sentAt: timestamp("sent_at"),
    deliveredAt: timestamp("delivered_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    statusIdx: index("messages_status_idx").on(table.status),
    errorCodeIdx: index("messages_error_code_idx").on(table.errorCode),
    sentAtIdx: index("messages_sent_at_idx").on(table.sentAt),
    deliveredAtIdx: index("messages_delivered_at_idx").on(table.deliveredAt),
  }),
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
      table.code,
    ),
  }),
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
    "0.00",
  ),
  clickRate: decimal("click_rate", { precision: 5, scale: 2 }).default("0.00"),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id")
    .references(() => businesses.id)
    .notNull(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

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
  customerProfileSid: varchar("customer_profile_sid", { length: 64 }),
  brandSid: varchar("brand_sid", { length: 64 }),
  campaignSid: varchar("campaign_sid", { length: 64 }),
  registrationStatus: text("registration_status")
    .default("not_started")
    .notNull(),
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
  authTokenEncrypted: text("auth_token_encrypted").notNull(),
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const twilioA2pConfigs = pgTable("twilio_a2p_config", {
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
  a2pConfig: many(twilioA2pConfigs),
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
  couponRedemptions,
).omit({
  id: true,
  businessId: true,
  createdAt: true,
});

export const insertCouponRecipientSchema = createInsertSchema(
  couponRecipients,
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
  businessProfiles,
).omit({
  id: true,
  businessId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTwilioCredentialSchema = createInsertSchema(
  twilioCredentials,
).omit({
  id: true,
  businessId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBusinessPhoneNumberSchema = createInsertSchema(
  businessPhoneNumbers,
).omit({
  id: true,
  businessId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTwilioA2pConfigSchema = createInsertSchema(
  twilioA2pConfigs,
).omit({
  id: true,
  businessId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
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
export type InsertBusiness = z.infer<typeof insertBusinessSchema>;

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

export type TwilioA2pConfig = typeof twilioA2pConfigs.$inferSelect;
export type InsertTwilioA2pConfig = z.infer<typeof insertTwilioA2pConfigSchema>;
