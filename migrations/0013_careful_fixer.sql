CREATE TABLE "keyword_campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer NOT NULL,
	"keyword" varchar(50) NOT NULL,
	"message" varchar(160) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "keyword_responses" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer NOT NULL,
	"keyword_campaign_id" integer NOT NULL,
	"contact_id" integer NOT NULL,
	"phone_number" varchar(20) NOT NULL,
	"message_sent" text NOT NULL,
	"responded_at" timestamp DEFAULT now() NOT NULL,
	"message_sid" varchar(64),
	"status" text DEFAULT 'sent' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messaging_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer NOT NULL,
	"use_cases" text[] NOT NULL,
	"volume" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "messaging_config_business_id_unique" UNIQUE("business_id")
);
--> statement-breakpoint
ALTER TABLE "twilio_a2p_config" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "twilio_a2p_config" CASCADE;--> statement-breakpoint
DROP INDEX "messages_error_code_idx";--> statement-breakpoint
DROP INDEX "messages_sent_at_idx";--> statement-breakpoint
DROP INDEX "messages_status_idx";--> statement-breakpoint
DROP INDEX "coupons_business_id_code_idx";--> statement-breakpoint
DROP INDEX "users_business_id_username_idx";--> statement-breakpoint
DROP INDEX "users_business_id_username_lookup_idx";--> statement-breakpoint
DROP INDEX "contacts_business_id_phone_number_idx";--> statement-breakpoint
DROP INDEX "contacts_business_id_phone_number_lookup_idx";--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "contact_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ALTER COLUMN "plan" SET DEFAULT 'free_trial';--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "message_type" text DEFAULT 'regular' NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "billing_status" text DEFAULT 'success' NOT NULL;--> statement-breakpoint
ALTER TABLE "onboarding_progress" ADD COLUMN "initial_message" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "trial_used" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "trial_voided_at" timestamp;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "messaging_service_sid" varchar(64);--> statement-breakpoint
ALTER TABLE "business_phone_numbers" ADD COLUMN "tfv_sid" varchar(64);--> statement-breakpoint
ALTER TABLE "business_phone_numbers" ADD COLUMN "verification_status" text DEFAULT 'PENDING_REVIEW' NOT NULL;--> statement-breakpoint
ALTER TABLE "keyword_campaigns" ADD CONSTRAINT "keyword_campaigns_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "keyword_responses" ADD CONSTRAINT "keyword_responses_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "keyword_responses" ADD CONSTRAINT "keyword_responses_keyword_campaign_id_keyword_campaigns_id_fk" FOREIGN KEY ("keyword_campaign_id") REFERENCES "public"."keyword_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "keyword_responses" ADD CONSTRAINT "keyword_responses_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messaging_config" ADD CONSTRAINT "messaging_config_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "keyword_campaigns_business_id_keyword_idx" ON "keyword_campaigns" USING btree ("business_id","keyword");--> statement-breakpoint
CREATE INDEX "keyword_campaigns_business_id_keyword_lookup_idx" ON "keyword_campaigns" USING btree ("business_id","keyword");--> statement-breakpoint
CREATE INDEX "keyword_campaigns_is_active_idx" ON "keyword_campaigns" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "keyword_campaigns_expires_at_idx" ON "keyword_campaigns" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "keyword_campaigns_deleted_at_idx" ON "keyword_campaigns" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "keyword_responses_contact_id_keyword_campaign_id_idx" ON "keyword_responses" USING btree ("contact_id","keyword_campaign_id");--> statement-breakpoint
CREATE INDEX "keyword_responses_business_id_idx" ON "keyword_responses" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "keyword_responses_keyword_campaign_id_idx" ON "keyword_responses" USING btree ("keyword_campaign_id");--> statement-breakpoint
CREATE INDEX "keyword_responses_contact_id_idx" ON "keyword_responses" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "keyword_responses_phone_number_idx" ON "keyword_responses" USING btree ("phone_number");--> statement-breakpoint
CREATE INDEX "keyword_responses_status_idx" ON "keyword_responses" USING btree ("status");--> statement-breakpoint
CREATE INDEX "messages_contact_id_idx" ON "messages" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "messages_business_id_idx" ON "messages" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "messages_campaign_id_idx" ON "messages" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "messages_message_type_idx" ON "messages" USING btree ("message_type");--> statement-breakpoint
CREATE INDEX "messages_billing_status_idx" ON "messages" USING btree ("billing_status");--> statement-breakpoint
CREATE INDEX "contacts_source_idx" ON "contacts" USING btree ("source");--> statement-breakpoint
CREATE UNIQUE INDEX "coupons_business_id_code_idx" ON "coupons" USING btree ("business_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "users_business_id_username_idx" ON "users" USING btree ("business_id","username");--> statement-breakpoint
CREATE INDEX "users_business_id_username_lookup_idx" ON "users" USING btree ("business_id","username");--> statement-breakpoint
CREATE UNIQUE INDEX "contacts_business_id_phone_number_idx" ON "contacts" USING btree ("business_id","phone_number");--> statement-breakpoint
CREATE INDEX "contacts_business_id_phone_number_lookup_idx" ON "contacts" USING btree ("business_id","phone_number");--> statement-breakpoint
ALTER TABLE "business_profiles" DROP COLUMN "customer_profile_sid";--> statement-breakpoint
ALTER TABLE "business_profiles" DROP COLUMN "brand_sid";--> statement-breakpoint
ALTER TABLE "business_profiles" DROP COLUMN "campaign_sid";--> statement-breakpoint
ALTER TABLE "business_profiles" DROP COLUMN "registration_status";