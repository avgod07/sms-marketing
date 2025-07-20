import {
  pgTable,
  index,
  foreignKey,
  serial,
  integer,
  text,
  varchar,
  timestamp,
  unique,
  boolean,
  numeric,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const messages = pgTable(
  "messages",
  {
    id: serial().primaryKey().notNull(),
    businessId: integer("business_id").notNull(),
    campaignId: integer("campaign_id"),
    contactId: integer("contact_id").notNull(),
    content: text().notNull(),
    phoneNumber: varchar("phone_number", { length: 20 }).notNull(),
    status: text().default("pending").notNull(),
    messageType: text("message_type").default("regular").notNull(),
    billingStatus: text("billing_status").default("success").notNull(),
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
    index("messages_error_code_idx").using(
      "btree",
      table.errorCode.asc().nullsLast().op("int4_ops")
    ),
    index("messages_sent_at_idx").using(
      "btree",
      table.sentAt.asc().nullsLast().op("timestamp_ops")
    ),
    index("messages_status_idx").using(
      "btree",
      table.status.asc().nullsLast().op("text_ops")
    ),
    index("messages_message_type_idx").using(
      "btree",
      table.messageType.asc().nullsLast().op("text_ops")
    ),
    index("messages_billing_status_idx").using(
      "btree",
      table.billingStatus.asc().nullsLast().op("text_ops")
    ),
    foreignKey({
      columns: [table.campaignId],
      foreignColumns: [campaigns.id],
      name: "messages_campaign_id_campaigns_id_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.contactId],
      foreignColumns: [contacts.id],
      name: "messages_contact_id_contacts_id_fk",
    }),
    foreignKey({
      columns: [table.businessId],
      foreignColumns: [businesses.id],
      name: "messages_business_id_businesses_id_fk",
    }),
  ]
);

export const onboardingProgress = pgTable(
  "onboarding_progress",
  {
    id: serial().primaryKey().notNull(),
    businessId: integer("business_id").notNull(),
    step: integer().default(1).notNull(),
    businessName: text("business_name"),
    websiteUrl: text("website_url"),
    address1: text(),
    address2: text(),
    city: text(),
    state: text(),
    postalCode: text("postal_code"),
    country: text(),
    firstName: text("first_name"),
    lastName: text("last_name"),
    email: text(),
    phoneNumber: text("phone_number"),
    monthlyVolume: text("monthly_volume"),
    useCases: text("use_cases").array(),
    createdAt: timestamp("created_at", { mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.businessId],
      foreignColumns: [businesses.id],
      name: "onboarding_progress_business_id_businesses_id_fk",
    }),
    unique("onboarding_progress_business_id_unique").on(table.businessId),
  ]
);

export const subscriptionEvents = pgTable(
  "subscription_events",
  {
    id: serial().primaryKey().notNull(),
    businessId: integer("business_id").notNull(),
    eventType: text("event_type").notNull(),
    stripeEventId: varchar("stripe_event_id", { length: 64 }),
    metadata: text(),
    createdAt: timestamp("created_at", { mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.businessId],
      foreignColumns: [businesses.id],
      name: "subscription_events_business_id_businesses_id_fk",
    }),
  ]
);

export const twilioA2PConfig = pgTable(
  "twilio_a2p_config",
  {
    id: serial().primaryKey().notNull(),
    businessId: integer("business_id").notNull(),
    useCases: text("use_cases").array().notNull(),
    volume: text().notNull(),
    createdAt: timestamp("created_at", { mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.businessId],
      foreignColumns: [businesses.id],
      name: "twilio_a2p_config_business_id_businesses_id_fk",
    }),
    unique("twilio_a2p_config_business_id_unique").on(table.businessId),
  ]
);

export const subscriptionPlans = pgTable("subscription_plans", {
  id: serial().primaryKey().notNull(),
  name: text().notNull(),
  displayName: text("display_name").notNull(),
  priceId: varchar("price_id", { length: 64 }).notNull(),
  priceMonthly: integer("price_monthly").notNull(),
  priceYearly: integer("price_yearly").notNull(),
  features: text().array(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow().notNull(),
});

export const twilioCredentials = pgTable(
  "twilio_credentials",
  {
    id: serial().primaryKey().notNull(),
    businessId: integer("business_id").notNull(),
    accountSid: varchar("account_sid", { length: 64 }).notNull(),
    messagingServiceSid: varchar("messaging_service_sid", { length: 64 }),
    createdAt: timestamp("created_at", { mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.businessId],
      foreignColumns: [businesses.id],
      name: "twilio_credentials_business_id_businesses_id_fk",
    }),
    unique("twilio_credentials_business_id_unique").on(table.businessId),
  ]
);

export const creditTransactions = pgTable(
  "credit_transactions",
  {
    id: serial().primaryKey().notNull(),
    businessId: integer("business_id").notNull(),
    type: text().notNull(),
    amount: integer().notNull(),
    description: text(),
    metadata: text(),
    createdAt: timestamp("created_at", { mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.businessId],
      foreignColumns: [businesses.id],
      name: "credit_transactions_business_id_businesses_id_fk",
    }),
  ]
);

export const analytics = pgTable(
  "analytics",
  {
    id: serial().primaryKey().notNull(),
    businessId: integer("business_id").notNull(),
    date: timestamp({ mode: "string" }).defaultNow().notNull(),
    totalContacts: integer("total_contacts").default(0),
    messagesSent: integer("messages_sent").default(0),
    deliveryRate: numeric("delivery_rate", { precision: 5, scale: 2 }).default(
      "0.00"
    ),
    clickRate: numeric("click_rate", { precision: 5, scale: 2 }).default(
      "0.00"
    ),
  },
  (table) => [
    foreignKey({
      columns: [table.businessId],
      foreignColumns: [businesses.id],
      name: "analytics_business_id_businesses_id_fk",
    }),
  ]
);

export const coupons = pgTable(
  "coupons",
  {
    id: serial().primaryKey().notNull(),
    businessId: integer("business_id").notNull(),
    code: text().notNull(),
    label: text(),
    type: text().notNull(),
    value: numeric({ precision: 10, scale: 2 }).notNull(),
    usageCount: integer("usage_count").default(0),
    expirationDate: timestamp("expiration_date", { mode: "string" }),
    validDays: integer("valid_days"),
    status: text().default("active").notNull(),
    createdAt: timestamp("created_at", { mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("coupons_business_id_code_idx").using(
      "btree",
      table.businessId.asc().nullsLast().op("int4_ops"),
      table.code.asc().nullsLast().op("int4_ops")
    ),
    foreignKey({
      columns: [table.businessId],
      foreignColumns: [businesses.id],
      name: "coupons_business_id_businesses_id_fk",
    }),
  ]
);

export const users = pgTable(
  "users",
  {
    id: serial().primaryKey().notNull(),
    businessId: integer("business_id").notNull(),
    username: text().notNull(),
    passwordHash: text("password_hash").notNull(),
    clerkId: varchar("clerk_id", { length: 64 }),
    onboardingComplete: boolean("onboarding_complete").default(false).notNull(),
    createdAt: timestamp("created_at", { mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("users_business_id_username_idx").using(
      "btree",
      table.businessId.asc().nullsLast().op("int4_ops"),
      table.username.asc().nullsLast().op("int4_ops")
    ),
    index("users_business_id_username_lookup_idx").using(
      "btree",
      table.businessId.asc().nullsLast().op("int4_ops"),
      table.username.asc().nullsLast().op("text_ops")
    ),
    foreignKey({
      columns: [table.businessId],
      foreignColumns: [businesses.id],
      name: "users_business_id_businesses_id_fk",
    }),
    unique("users_clerk_id_unique").on(table.clerkId),
  ]
);

export const businessProfiles = pgTable(
  "business_profiles",
  {
    id: serial().primaryKey().notNull(),
    businessId: integer("business_id").notNull(),
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
    sample1: text().notNull(),
    sample2: text().notNull(),
    customerProfileSid: varchar("customer_profile_sid", { length: 64 }),
    brandSid: varchar("brand_sid", { length: 64 }),
    campaignSid: varchar("campaign_sid", { length: 64 }),
    registrationStatus: text("registration_status")
      .default("not_started")
      .notNull(),
    status: text().default("provided").notNull(),
    createdAt: timestamp("created_at", { mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.businessId],
      foreignColumns: [businesses.id],
      name: "business_profiles_business_id_businesses_id_fk",
    }),
    unique("business_profiles_business_id_unique").on(table.businessId),
  ]
);

export const campaigns = pgTable(
  "campaigns",
  {
    id: serial().primaryKey().notNull(),
    businessId: integer("business_id").notNull(),
    name: text().notNull(),
    message: text().notNull(),
    mediaUrl: text("media_url"),
    status: text().default("in_progress").notNull(),
    sentCount: integer("sent_count").default(0),
    deliveredCount: integer("delivered_count").default(0),
    clickCount: integer("click_count").default(0),
    scheduledAt: timestamp("scheduled_at", { mode: "string" }),
    createdAt: timestamp("created_at", { mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.businessId],
      foreignColumns: [businesses.id],
      name: "campaigns_business_id_businesses_id_fk",
    }),
  ]
);

export const businessCredits = pgTable(
  "business_credits",
  {
    id: serial().primaryKey().notNull(),
    businessId: integer("business_id").notNull(),
    balance: integer().default(0).notNull(),
    createdAt: timestamp("created_at", { mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.businessId],
      foreignColumns: [businesses.id],
      name: "business_credits_business_id_businesses_id_fk",
    }),
    unique("business_credits_business_id_unique").on(table.businessId),
  ]
);

export const contacts = pgTable(
  "contacts",
  {
    id: serial().primaryKey().notNull(),
    businessId: integer("business_id").notNull(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    phoneNumber: varchar("phone_number", { length: 20 }).notNull(),
    email: text(),
    active: boolean().default(true).notNull(),
    createdAt: timestamp("created_at", { mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("contacts_business_id_phone_number_idx").using(
      "btree",
      table.businessId.asc().nullsLast().op("int4_ops"),
      table.phoneNumber.asc().nullsLast().op("int4_ops")
    ),
    index("contacts_business_id_phone_number_lookup_idx").using(
      "btree",
      table.businessId.asc().nullsLast().op("text_ops"),
      table.phoneNumber.asc().nullsLast().op("text_ops")
    ),
    foreignKey({
      columns: [table.businessId],
      foreignColumns: [businesses.id],
      name: "contacts_business_id_businesses_id_fk",
    }),
  ]
);

export const couponRecipients = pgTable(
  "coupon_recipients",
  {
    id: serial().primaryKey().notNull(),
    businessId: integer("business_id").notNull(),
    couponId: integer("coupon_id").notNull(),
    campaignId: integer("campaign_id").notNull(),
    contactId: integer("contact_id").notNull(),
    createdAt: timestamp("created_at", { mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.businessId],
      foreignColumns: [businesses.id],
      name: "coupon_recipients_business_id_businesses_id_fk",
    }),
    foreignKey({
      columns: [table.couponId],
      foreignColumns: [coupons.id],
      name: "coupon_recipients_coupon_id_coupons_id_fk",
    }),
    foreignKey({
      columns: [table.campaignId],
      foreignColumns: [campaigns.id],
      name: "coupon_recipients_campaign_id_campaigns_id_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.contactId],
      foreignColumns: [contacts.id],
      name: "coupon_recipients_contact_id_contacts_id_fk",
    }),
  ]
);

export const businesses = pgTable("businesses", {
  id: serial().primaryKey().notNull(),
  name: text().notNull(),
  plan: text().default("free_trial").notNull(),
  trialEndsAt: timestamp("trial_ends_at", { mode: "string" }),
  trialUsed: boolean("trial_used").default(false).notNull(),
  trialVoidedAt: timestamp("trial_voided_at", { mode: "string" }),
  stripeCustomerId: varchar("stripe_customer_id", { length: 64 }),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 64 }),
  initialMessage: text("initial_message"),
  onboardingComplete: boolean("onboarding_complete").default(false).notNull(),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
});

export const businessPhoneNumbers = pgTable(
  "business_phone_numbers",
  {
    id: serial().primaryKey().notNull(),
    businessId: integer("business_id").notNull(),
    phoneNumber: varchar("phone_number", { length: 20 }).notNull(),
    isDefault: boolean("is_default").default(false).notNull(),
    phoneSid: varchar("phone_sid", { length: 64 }),
    serviceSid: varchar("service_sid", { length: 64 }),
    assignmentStatus: text("assignment_status"),
    createdAt: timestamp("created_at", { mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.businessId],
      foreignColumns: [businesses.id],
      name: "business_phone_numbers_business_id_businesses_id_fk",
    }),
  ]
);

export const couponRedemptions = pgTable(
  "coupon_redemptions",
  {
    id: serial().primaryKey().notNull(),
    businessId: integer("business_id").notNull(),
    couponId: integer("coupon_id").notNull(),
    contactId: integer("contact_id"),
    phoneNumber: varchar("phone_number", { length: 20 }),
    note: text(),
    createdAt: timestamp("created_at", { mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.businessId],
      foreignColumns: [businesses.id],
      name: "coupon_redemptions_business_id_businesses_id_fk",
    }),
    foreignKey({
      columns: [table.couponId],
      foreignColumns: [coupons.id],
      name: "coupon_redemptions_coupon_id_coupons_id_fk",
    }),
    foreignKey({
      columns: [table.contactId],
      foreignColumns: [contacts.id],
      name: "coupon_redemptions_contact_id_contacts_id_fk",
    }),
  ]
);
