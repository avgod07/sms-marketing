-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer NOT NULL,
	"campaign_id" integer,
	"contact_id" integer NOT NULL,
	"content" text NOT NULL,
	"phone_number" varchar(20) NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"message_sid" varchar(64),
	"error_code" integer,
	"sent_at" timestamp,
	"delivered_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "onboarding_progress" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer NOT NULL,
	"step" integer DEFAULT 1 NOT NULL,
	"business_name" text,
	"website_url" text,
	"address1" text,
	"address2" text,
	"city" text,
	"state" text,
	"postal_code" text,
	"country" text,
	"first_name" text,
	"last_name" text,
	"email" text,
	"phone_number" text,
	"monthly_volume" text,
	"use_cases" text[],
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "onboarding_progress_business_id_unique" UNIQUE("business_id")
);
--> statement-breakpoint
CREATE TABLE "subscription_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer NOT NULL,
	"event_type" text NOT NULL,
	"stripe_event_id" varchar(64),
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "twilio_a2p_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer NOT NULL,
	"use_cases" text[] NOT NULL,
	"volume" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "twilio_a2p_config_business_id_unique" UNIQUE("business_id")
);
--> statement-breakpoint
CREATE TABLE "subscription_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"display_name" text NOT NULL,
	"price_id" varchar(64) NOT NULL,
	"price_monthly" integer NOT NULL,
	"price_yearly" integer NOT NULL,
	"features" text[],
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "twilio_credentials" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer NOT NULL,
	"account_sid" varchar(64) NOT NULL,
	"messaging_service_sid" varchar(64),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "twilio_credentials_business_id_unique" UNIQUE("business_id")
);
--> statement-breakpoint
CREATE TABLE "credit_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer NOT NULL,
	"type" text NOT NULL,
	"amount" integer NOT NULL,
	"description" text,
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer NOT NULL,
	"date" timestamp DEFAULT now() NOT NULL,
	"total_contacts" integer DEFAULT 0,
	"messages_sent" integer DEFAULT 0,
	"delivery_rate" numeric(5, 2) DEFAULT '0.00',
	"click_rate" numeric(5, 2) DEFAULT '0.00'
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer NOT NULL,
	"code" text NOT NULL,
	"label" text,
	"type" text NOT NULL,
	"value" numeric(10, 2) NOT NULL,
	"usage_count" integer DEFAULT 0,
	"expiration_date" timestamp,
	"valid_days" integer,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"clerk_id" varchar(64),
	"onboarding_complete" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_clerk_id_unique" UNIQUE("clerk_id")
);
--> statement-breakpoint
CREATE TABLE "business_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer NOT NULL,
	"address_street" text NOT NULL,
	"address_city" text NOT NULL,
	"address_state" text NOT NULL,
	"address_postal_code" text NOT NULL,
	"address_country" text NOT NULL,
	"organization_type" text NOT NULL,
	"company_status" text NOT NULL,
	"stock_ticker" text,
	"tax_id" text NOT NULL,
	"industry_sector" text NOT NULL,
	"regions_of_operation" text NOT NULL,
	"rep_name" text NOT NULL,
	"rep_title" text NOT NULL,
	"rep_email" text NOT NULL,
	"rep_phone" varchar(20) NOT NULL,
	"use_case" text NOT NULL,
	"campaign_description" text NOT NULL,
	"sample1" text NOT NULL,
	"sample2" text NOT NULL,
	"customer_profile_sid" varchar(64),
	"brand_sid" varchar(64),
	"campaign_sid" varchar(64),
	"registration_status" text DEFAULT 'not_started' NOT NULL,
	"status" text DEFAULT 'provided' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "business_profiles_business_id_unique" UNIQUE("business_id")
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer NOT NULL,
	"name" text NOT NULL,
	"message" text NOT NULL,
	"media_url" text,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"sent_count" integer DEFAULT 0,
	"delivered_count" integer DEFAULT 0,
	"click_count" integer DEFAULT 0,
	"scheduled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_credits" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "business_credits_business_id_unique" UNIQUE("business_id")
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"phone_number" varchar(20) NOT NULL,
	"email" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coupon_recipients" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer NOT NULL,
	"coupon_id" integer NOT NULL,
	"campaign_id" integer NOT NULL,
	"contact_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "businesses" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"plan" text DEFAULT 'trial' NOT NULL,
	"trial_ends_at" timestamp,
	"stripe_customer_id" varchar(64),
	"stripe_subscription_id" varchar(64),
	"initial_message" text,
	"onboarding_complete" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_phone_numbers" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer NOT NULL,
	"phone_number" varchar(20) NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"phone_sid" varchar(64),
	"service_sid" varchar(64),
	"assignment_status" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coupon_redemptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer NOT NULL,
	"coupon_id" integer NOT NULL,
	"contact_id" integer,
	"phone_number" varchar(20),
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_progress" ADD CONSTRAINT "onboarding_progress_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "twilio_a2p_config" ADD CONSTRAINT "twilio_a2p_config_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "twilio_credentials" ADD CONSTRAINT "twilio_credentials_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics" ADD CONSTRAINT "analytics_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_profiles" ADD CONSTRAINT "business_profiles_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_credits" ADD CONSTRAINT "business_credits_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_recipients" ADD CONSTRAINT "coupon_recipients_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_recipients" ADD CONSTRAINT "coupon_recipients_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_recipients" ADD CONSTRAINT "coupon_recipients_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_recipients" ADD CONSTRAINT "coupon_recipients_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_phone_numbers" ADD CONSTRAINT "business_phone_numbers_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "messages_delivered_at_idx" ON "messages" USING btree ("delivered_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "messages_error_code_idx" ON "messages" USING btree ("error_code" int4_ops);--> statement-breakpoint
CREATE INDEX "messages_sent_at_idx" ON "messages" USING btree ("sent_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "messages_status_idx" ON "messages" USING btree ("status" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "coupons_business_id_code_idx" ON "coupons" USING btree ("business_id" int4_ops,"code" int4_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "users_business_id_username_idx" ON "users" USING btree ("business_id" int4_ops,"username" int4_ops);--> statement-breakpoint
CREATE INDEX "users_business_id_username_lookup_idx" ON "users" USING btree ("business_id" int4_ops,"username" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "contacts_business_id_phone_number_idx" ON "contacts" USING btree ("business_id" int4_ops,"phone_number" int4_ops);--> statement-breakpoint
CREATE INDEX "contacts_business_id_phone_number_lookup_idx" ON "contacts" USING btree ("business_id" text_ops,"phone_number" text_ops);
*/