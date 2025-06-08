import { pgTable, text, serial, integer, boolean, timestamp, varchar, decimal } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phoneNumber: varchar("phone_number", { length: 20 }).notNull().unique(),
  email: text("email"),
  segment: text("segment").notNull().default("all"), // all, active, inactive
  status: text("status").notNull().default("active"), // active, inactive
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const campaigns = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  message: text("message").notNull(),
  audience: text("audience").notNull(), // all, active, inactive
  status: text("status").notNull().default("active"), // active, completed, paused
  sentCount: integer("sent_count").default(0),
  deliveredCount: integer("delivered_count").default(0),
  clickCount: integer("click_count").default(0),
  scheduledAt: timestamp("scheduled_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").references(() => campaigns.id),
  contactId: integer("contact_id").references(() => contacts.id).notNull(),
  content: text("content").notNull(),
  phoneNumber: varchar("phone_number", { length: 20 }).notNull(),
  status: text("status").notNull().default("pending"), // pending, sent, delivered, failed
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const analytics = pgTable("analytics", {
  id: serial("id").primaryKey(),
  date: timestamp("date").defaultNow().notNull(),
  totalContacts: integer("total_contacts").default(0),
  messagesSent: integer("messages_sent").default(0),
  deliveryRate: decimal("delivery_rate", { precision: 5, scale: 2 }).default("0.00"),
  clickRate: decimal("click_rate", { precision: 5, scale: 2 }).default("0.00"),
});

export const coupons = pgTable("coupons", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 255 }).notNull().unique(),
  discount: integer("discount").notNull(),
  expirationDate: timestamp("expiration_date"),
  validDays: integer("valid_days"),
  usageLimit: integer("usage_limit"),
  reusable: boolean("reusable").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
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

// Insert schemas
export const insertContactSchema = createInsertSchema(contacts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCampaignSchema = createInsertSchema(campaigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  sentCount: true,
  deliveredCount: true,
  clickCount: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
  sentAt: true,
  deliveredAt: true,
});

export const insertCouponBaseSchema = createInsertSchema(coupons).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCouponSchema = insertCouponBaseSchema
  .refine(data => !(data.expirationDate && data.validDays), {
    message: "Choose either expiration date or valid days",
    path: ["validDays"],
  })
  .refine(data => !(data.reusable && data.usageLimit), {
    message: "Either reusable or usage limit, not both",
    path: ["usageLimit"],
  });

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

// Types
export type Contact = typeof contacts.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;

export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

export type Coupon = typeof coupons.$inferSelect;
export type InsertCoupon = z.infer<typeof insertCouponSchema>;

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Analytics = typeof analytics.$inferSelect;
