import {
  contacts,
  campaigns,
  messages,
  coupons,
  couponRedemptions,
  couponRecipients,
  analytics,
  users,
  businesses,
  type Contact,
  type InsertContact,
  type Campaign,
  type InsertCampaign,
  type Message,
  type InsertMessage,
  type Coupon,
  type InsertCoupon,
  type CouponRedemption,
  type InsertCouponRedemption,
  type CouponRecipient,
  type InsertCouponRecipient,
  type Analytics,
  type User,
  type InsertUser,
  type Business,
  type InsertBusiness,
  businessProfiles,
  type BusinessProfile,
  type InsertBusinessProfile,
  twilioCredentials,
  type TwilioCredential,
  type InsertTwilioCredential,
  businessPhoneNumbers,
  type BusinessPhoneNumber,
  type InsertBusinessPhoneNumber,
  messagingConfigs,
  type MessagingConfig,
  type InsertMessagingConfig,
  // Legacy aliases
  type TwilioA2pConfig,
  type InsertTwilioA2pConfig,
  businessCredits,
  type BusinessCredit,
  type InsertBusinessCredit,
  creditTransactions,
  type CreditTransaction,
  type InsertCreditTransaction,
  onboardingProgress,
  type OnboardingProgress,
  type InsertOnboardingProgress,
  subscriptionPlans,
  type SubscriptionPlan,
  type InsertSubscriptionPlan,
  subscriptionEvents,
  type SubscriptionEvent,
  type InsertSubscriptionEvent,
  smsCommandSenders,
  type SmsCommandSender,
  type InsertSmsCommandSender,
  smsCommandRateLimits,
  type SmsCommandRateLimit,
  type InsertSmsCommandRateLimit,
  smsCommandPending,
  type SmsCommandPending,
  type InsertSmsCommandPending,
  messageQueue,
  type MessageQueue,
} from "@shared/schema";
import type {
  ContactRedemption,
  CampaignWithQueue,
  RecentCampaign,
} from "@shared/api-types";
import { db } from "../config/db.config";
import { eq, desc, asc, count, sql, and } from "drizzle-orm";
import { normalizePhoneNumber } from "../utils/normalize.util";
import { logError } from "../utils/logger.util";

export interface IStorage {
  forBusiness(businessId: number): IStorage;
  createBusiness(business: InsertBusiness): Promise<Business>;
  updateBusiness(business: Partial<InsertBusiness>): Promise<Business>;
  getBusiness(): Promise<Business>;
  getBusinessProfile(): Promise<BusinessProfile | undefined>;
  upsertBusinessProfile(
    profile: InsertBusinessProfile
  ): Promise<BusinessProfile>;
  // Twilio
  getTwilioCredentials(): Promise<TwilioCredential | undefined>;
  upsertTwilioCredentials(
    creds: InsertTwilioCredential & { messagingServiceSid?: string }
  ): Promise<TwilioCredential>;
  // New messaging service management
  getMessagingServiceSid(): Promise<string | undefined>;
  setMessagingServiceSid(serviceSid: string): Promise<Business>;
  ensureMessagingServiceSid(): Promise<string>;
  getPhoneNumbers(): Promise<BusinessPhoneNumber[]>;
  setPhoneNumbers(
    numbers: InsertBusinessPhoneNumber[]
  ): Promise<BusinessPhoneNumber[]>;
  updatePhoneNumberTFV(
    phoneNumberId: number,
    tfvSid: string,
    verificationStatus: string
  ): Promise<BusinessPhoneNumber>;
  // TFV Verification status checking
  getTFVVerificationStatus(): Promise<{
    isVerified: boolean;
    status: string;
    hasPhoneNumbers: boolean;
    pendingTFVs: Array<{ tfvSid: string; phoneNumber: string }>;
  }>;
  refreshTFVStatusFromTwilio(): Promise<void>;
  getTwilioA2PConfig(): Promise<TwilioA2pConfig | undefined>;
  upsertTwilioA2PConfig(
    config: InsertTwilioA2pConfig
  ): Promise<TwilioA2pConfig>;
  // Contacts
  getContacts(): Promise<Contact[]>;
  getContact(id: number): Promise<Contact | undefined>;
  getContactByPhoneNumber(phoneNumber: string): Promise<Contact | undefined>;
  createContact(
    contact: InsertContact & { consentDate?: Date; consentMethod?: string }
  ): Promise<Contact>;
  updateContact(
    id: number,
    contact: Partial<InsertContact> & { active?: boolean }
  ): Promise<Contact>;
  deleteContact(id: number): Promise<void>;
  searchContacts(query: string): Promise<Contact[]>;

  // Campaigns
  getCampaigns(): Promise<CampaignWithQueue[]>;
  getCampaign(id: number): Promise<Campaign | undefined>;
  createCampaign(campaign: InsertCampaign): Promise<Campaign>;
  updateCampaign(id: number, campaign: Partial<Campaign>): Promise<Campaign>;
  deleteCampaign(id: number): Promise<void>;

  // Coupons
  getCoupons(): Promise<Coupon[]>;
  getCoupon(id: number): Promise<Coupon | undefined>;
  getCouponByCode(code: string): Promise<Coupon | undefined>;
  createCoupon(coupon: InsertCoupon): Promise<Coupon>;
  updateCoupon(id: number, coupon: Partial<Coupon>): Promise<Coupon>;
  deleteCoupon(id: number): Promise<void>;
  createCouponRedemption(
    redemption: InsertCouponRedemption
  ): Promise<CouponRedemption>;
  getCouponRedemptions(couponId: number): Promise<CouponRedemption[]>;
  getContactRedemptions(contactId: number): Promise<ContactRedemption[]>;
  searchCoupons(filters: {
    search?: string;
    status?: string;
    type?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<Coupon[]>;
  createCouponRecipient(
    recipient: InsertCouponRecipient
  ): Promise<CouponRecipient>;
  hasContactReceivedCoupon(
    contactId: number,
    couponCode: string
  ): Promise<boolean>;
  hasContactRedeemedCoupon(
    contactId: number,
    couponId: number
  ): Promise<boolean>;

  // Messages
  getMessages(): Promise<Message[]>;
  getMessagesByCampaign(campaignId: number): Promise<Message[]>;
  getMessagesByContact(contactId: number): Promise<Message[]>;
  getConversationSummaries(): Promise<any[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  updateMessageStatus(
    id: number,
    status: string,
    deliveredAt?: Date,
    errorCode?: number
  ): Promise<Message>;
  updateMessageStatusBySid(
    sid: string,
    status: string,
    errorCode?: number
  ): Promise<Message | undefined>;

  // Analytics
  getDashboardStats(): Promise<{
    totalContacts: number;
    messagesSent: number;
    activeCampaigns: number;
    deliveryRate: number;
    contactsChange: number | null;
    messagesChange: number | null;
    campaignsChange: number | null;
    deliveryRateChange: number | null;
  }>;
  getAnalytics(
    range: "thisMonth" | "lastMonth" | "thisWeek" | "lastWeek"
  ): Promise<Analytics[]>;
  getContactStats(): Promise<{
    allContacts: number;
  }>;
  getCouponStats(): Promise<{
    allCoupons: number;
  }>;
  getCampaignStats(): Promise<{
    activeCampaigns: number;
    campaignsThisMonth: number;
    scheduledCampaigns: number;
  }>;

  // Recent Activity
  getRecentContacts(limit?: number): Promise<Contact[]>;
  getRecentCampaigns(limit?: number): Promise<RecentCampaign[]>;
  getRecentMessages(limit?: number): Promise<Message[]>;
  getRecentInboxMessages(limit?: number): Promise<Message[]>;

  // Users
  // The following fetchers are intentionally accessible without
  // scoping to a business. They are used during authentication
  // before the tenant context is known.
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByClerkId(clerkId: string): Promise<User | undefined>;
  getUserById(id: number): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Credits
  getCredits(): Promise<BusinessCredit | undefined>;
  adjustCredits(
    amount: number,
    type: string,
    description?: string,
    metadata?: Record<string, any>
  ): Promise<BusinessCredit>;
  getCreditTransactions(): Promise<CreditTransaction[]>;

  // Onboarding Progress
  getOnboardingProgress(): Promise<OnboardingProgress | undefined>;
  upsertOnboardingProgress(
    progress: InsertOnboardingProgress
  ): Promise<OnboardingProgress>;

  // Subscription Management
  getSubscriptionPlans(): Promise<SubscriptionPlan[]>;
  getSubscriptionPlan(name: string): Promise<SubscriptionPlan | undefined>;
  updateBusinessPlan(
    plan: string,
    stripeCustomerId?: string,
    stripeSubscriptionId?: string,
    trialVoidedAt?: Date
  ): Promise<Business>;
  recordSubscriptionEvent(
    eventType: string,
    stripeEventId?: string,
    metadata?: Record<string, any>
  ): Promise<SubscriptionEvent>;
  getSubscriptionEvents(): Promise<SubscriptionEvent[]>;

  // SMS Command Pending Management
  storePendingSMSCommand(
    data: InsertSmsCommandPending
  ): Promise<SmsCommandPending>;
  getPendingSMSCommand(businessId: number): Promise<SmsCommandPending | null>;
  clearPendingSMSCommand(businessId: number): Promise<void>;
  cleanupExpiredSMSCommands(): Promise<number>;
}

export class DatabaseStorage implements IStorage {
  constructor(private businessId?: number) {}

  private requireBusinessId(): number {
    if (this.businessId === undefined) {
      throw new Error("Business ID is required");
    }
    return this.businessId;
  }

  forBusiness(businessId: number): IStorage {
    if (!businessId || Number.isNaN(businessId) || businessId <= 0) {
      logError("Invalid business ID passed to forBusiness", { businessId });
      throw new Error("Invalid business ID");
    }
    return new DatabaseStorage(businessId);
  }

  private normalizeCouponStatus(coupon: Coupon): Coupon {
    const isExpired =
      (coupon.expirationDate && new Date(coupon.expirationDate) < new Date()) ||
      (coupon.validDays !== null &&
        coupon.validDays !== undefined &&
        new Date(coupon.createdAt).getTime() +
          coupon.validDays * 24 * 60 * 60 * 1000 <
          Date.now());
    const status =
      coupon.status === "active" && !isExpired ? "active" : "inactive";
    return { ...coupon, status };
  }
  // Contacts
  async getContacts(): Promise<Contact[]> {
    const businessId = this.requireBusinessId();
    return await db
      .select()
      .from(contacts)
      .where(eq(contacts.businessId, businessId))
      .orderBy(desc(contacts.createdAt));
  }

  async getContact(id: number): Promise<Contact | undefined> {
    const businessId = this.requireBusinessId();
    const [contact] = await db
      .select()
      .from(contacts)
      .where(
        sql`${contacts.id} = ${id} AND ${contacts.businessId} = ${businessId}`
      );
    return contact || undefined;
  }

  async createContact(
    contact: InsertContact & { consentDate?: Date; consentMethod?: string }
  ): Promise<Contact> {
    const businessId = this.requireBusinessId();
    const [newContact] = await db
      .insert(contacts)
      .values({
        ...contact,
        phoneNumber: normalizePhoneNumber(contact.phoneNumber),
        businessId,
        updatedAt: new Date(),
      })
      .returning();
    return newContact;
  }

  async updateContact(
    id: number,
    contact: Partial<InsertContact> & { active?: boolean }
  ): Promise<Contact> {
    const businessId = this.requireBusinessId();
    const updateData = {
      ...contact,
      ...(contact.phoneNumber
        ? { phoneNumber: normalizePhoneNumber(contact.phoneNumber) }
        : {}),
      updatedAt: new Date(),
    };
    const [updatedContact] = await db
      .update(contacts)
      .set(updateData)
      .where(
        sql`${contacts.id} = ${id} AND ${contacts.businessId} = ${businessId}`
      )
      .returning();
    return updatedContact;
  }

  async deleteContact(id: number): Promise<void> {
    const businessId = this.requireBusinessId();
    await db.transaction(async (tx) => {
      await tx
        .delete(messages)
        .where(
          sql`${messages.contactId} = ${id} AND ${messages.businessId} = ${businessId}`
        );
      await tx
        .delete(couponRecipients)
        .where(
          sql`${couponRecipients.contactId} = ${id} AND ${couponRecipients.businessId} = ${businessId}`
        );
      await tx
        .update(couponRedemptions)
        .set({ contactId: null })
        .where(
          sql`${couponRedemptions.contactId} = ${id} AND ${couponRedemptions.businessId} = ${businessId}`
        );
      await tx
        .delete(contacts)
        .where(
          sql`${contacts.id} = ${id} AND ${contacts.businessId} = ${businessId}`
        );
    });
  }

  async searchContacts(query: string): Promise<Contact[]> {
    const trimmed = query.trim();
    if (!trimmed) {
      return this.getContacts();
    }

    const tokens = trimmed.split(/\s+/);
    const businessId = this.requireBusinessId();

    const clauses = tokens.map(
      (token) =>
        sql`${contacts.firstName} ILIKE ${"%" + token + "%"} OR ${
          contacts.lastName
        } ILIKE ${"%" + token + "%"} OR ${contacts.phoneNumber} ILIKE ${
          "%" + token + "%"
        } OR ${contacts.email} ILIKE ${"%" + token + "%"} OR concat(${
          contacts.firstName
        }, ' ', ${contacts.lastName}) ILIKE ${"%" + token + "%"}`
    );

    let whereClause = clauses[0];
    for (let i = 1; i < clauses.length; i++) {
      whereClause = sql`(${whereClause}) AND (${clauses[i]})`;
    }

    return await db
      .select()
      .from(contacts)
      .where(sql`(${whereClause}) AND ${contacts.businessId} = ${businessId}`)
      .orderBy(desc(contacts.createdAt));
  }

  async getContactByPhoneNumber(
    phoneNumber: string
  ): Promise<Contact | undefined> {
    const normalized = normalizePhoneNumber(phoneNumber);
    const businessId = this.requireBusinessId();
    const [contact] = await db
      .select()
      .from(contacts)
      .where(
        sql`${contacts.phoneNumber} = ${normalized} AND ${contacts.businessId} = ${businessId}`
      );
    return contact || undefined;
  }

  async hasContactReceivedCoupon(
    contactId: number,
    couponCode: string
  ): Promise<boolean> {
    const businessId = this.requireBusinessId();
    const [row] = await db
      .select({ id: couponRecipients.id })
      .from(couponRecipients)
      .innerJoin(coupons, eq(couponRecipients.couponId, coupons.id))
      .where(
        sql`${couponRecipients.contactId} = ${contactId} AND ${coupons.code} = ${couponCode} AND ${couponRecipients.businessId} = ${businessId}`
      )
      .limit(1);
    return !!row;
  }

  async hasContactRedeemedCoupon(
    contactId: number,
    couponId: number
  ): Promise<boolean> {
    const businessId = this.requireBusinessId();
    const [row] = await db
      .select({ id: couponRedemptions.id })
      .from(couponRedemptions)
      .where(
        sql`${couponRedemptions.contactId} = ${contactId} AND ${couponRedemptions.couponId} = ${couponId} AND ${couponRedemptions.businessId} = ${businessId}`
      )
      .limit(1);
    return !!row;
  }

  // Campaigns
  async getCampaigns(): Promise<CampaignWithQueue[]> {
    const businessId = this.requireBusinessId();

    const campaignsWithQueue = await db
      .select({
        id: campaigns.id,
        businessId: campaigns.businessId,
        name: campaigns.name,
        message: campaigns.message,
        mediaUrl: campaigns.mediaUrl,
        status: campaigns.status,
        sentCount: campaigns.sentCount,
        deliveredCount: campaigns.deliveredCount,
        clickCount: campaigns.clickCount,
        scheduledAt: campaigns.scheduledAt,
        campaignSource: campaigns.campaignSource,
        commandSenderPhone: campaigns.commandSenderPhone,
        scheduledSendTime: campaigns.scheduledSendTime,
        schedulingType: campaigns.schedulingType,
        scheduledBy: campaigns.scheduledBy,
        scheduleNotes: campaigns.scheduleNotes,
        createdAt: campaigns.createdAt,
        updatedAt: campaigns.updatedAt,
        queuedMessageCount: sql<number>`COALESCE(COUNT(${messageQueue.id}), 0)`,
        nextQueuedSendTime: sql<Date>`MIN(${messageQueue.scheduledFor})`,
      })
      .from(campaigns)
      .leftJoin(
        messageQueue,
        and(
          sql`${messageQueue.metadata}::text LIKE '%"campaignId":' || ${campaigns.id} || '%'`,
          eq(messageQueue.status, "pending")
        )
      )
      .where(eq(campaigns.businessId, businessId))
      .groupBy(campaigns.id)
      .orderBy(desc(campaigns.createdAt));

    return campaignsWithQueue.map((campaign) => ({
      ...campaign,
      hasQueuedMessages: (campaign.queuedMessageCount || 0) > 0,
    }));
  }

  async getCampaign(id: number): Promise<Campaign | undefined> {
    const businessId = this.requireBusinessId();
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(
        sql`${campaigns.id} = ${id} AND ${campaigns.businessId} = ${businessId}`
      );
    return campaign || undefined;
  }

  async createCampaign(campaign: InsertCampaign): Promise<Campaign> {
    const businessId = this.requireBusinessId();
    const [newCampaign] = await db
      .insert(campaigns)
      .values({
        ...campaign,
        businessId,
        updatedAt: new Date(),
      })
      .returning();
    return newCampaign;
  }

  async updateCampaign(
    id: number,
    campaign: Partial<Campaign>
  ): Promise<Campaign> {
    const businessId = this.requireBusinessId();
    const [updatedCampaign] = await db
      .update(campaigns)
      .set({
        ...campaign,
        updatedAt: new Date(),
      })
      .where(
        sql`${campaigns.id} = ${id} AND ${campaigns.businessId} = ${businessId}`
      )
      .returning();
    return updatedCampaign;
  }

  async deleteCampaign(id: number): Promise<void> {
    const businessId = this.requireBusinessId();
    await db.transaction(async (tx) => {
      await tx
        .delete(messages)
        .where(
          sql`${messages.campaignId} = ${id} AND ${messages.businessId} = ${businessId}`
        );
      await tx
        .delete(couponRecipients)
        .where(
          sql`${couponRecipients.campaignId} = ${id} AND ${couponRecipients.businessId} = ${businessId}`
        );
      await tx
        .delete(campaigns)
        .where(
          sql`${campaigns.id} = ${id} AND ${campaigns.businessId} = ${businessId}`
        );
    });
  }

  // Coupons
  async getCoupons(): Promise<Coupon[]> {
    const businessId = this.requireBusinessId();
    const rows = await db
      .select()
      .from(coupons)
      .where(eq(coupons.businessId, businessId))
      .orderBy(desc(coupons.createdAt));
    return rows.map((c) => this.normalizeCouponStatus(c));
  }

  async getCoupon(id: number): Promise<Coupon | undefined> {
    const businessId = this.requireBusinessId();
    const [coupon] = await db
      .select()
      .from(coupons)
      .where(
        sql`${coupons.id} = ${id} AND ${coupons.businessId} = ${businessId}`
      );
    return coupon ? this.normalizeCouponStatus(coupon) : undefined;
  }

  async getCouponByCode(code: string): Promise<Coupon | undefined> {
    const businessId = this.requireBusinessId();
    const [coupon] = await db
      .select()
      .from(coupons)
      .where(
        sql`${coupons.code} = ${code} AND ${coupons.businessId} = ${businessId}`
      );
    return coupon || undefined;
  }

  async createCoupon(coupon: InsertCoupon): Promise<Coupon> {
    const businessId = this.requireBusinessId();
    const [newCoupon] = await db
      .insert(coupons)
      .values({
        ...coupon,
        businessId,
        updatedAt: new Date(),
      })
      .returning();
    return this.normalizeCouponStatus(newCoupon);
  }

  async updateCoupon(id: number, coupon: Partial<Coupon>): Promise<Coupon> {
    const businessId = this.requireBusinessId();
    const [updatedCoupon] = await db
      .update(coupons)
      .set({
        ...coupon,
        updatedAt: new Date(),
      })
      .where(
        sql`${coupons.id} = ${id} AND ${coupons.businessId} = ${businessId}`
      )
      .returning();
    return this.normalizeCouponStatus(updatedCoupon);
  }

  async deleteCoupon(id: number): Promise<void> {
    const businessId = this.requireBusinessId();
    await db
      .delete(coupons)
      .where(
        sql`${coupons.id} = ${id} AND ${coupons.businessId} = ${businessId}`
      );
  }

  async createCouponRedemption(
    redemption: InsertCouponRedemption
  ): Promise<CouponRedemption> {
    const businessId = this.requireBusinessId();
    const [newRedemption] = await db
      .insert(couponRedemptions)
      .values({ ...redemption, businessId })
      .returning();
    return newRedemption;
  }

  async createCouponRecipient(
    recipient: InsertCouponRecipient
  ): Promise<CouponRecipient> {
    const businessId = this.requireBusinessId();
    const [record] = await db
      .insert(couponRecipients)
      .values({ ...recipient, businessId })
      .returning();
    return record;
  }

  async getCouponRedemptions(couponId: number): Promise<CouponRedemption[]> {
    const businessId = this.requireBusinessId();
    return await db
      .select()
      .from(couponRedemptions)
      .where(
        sql`${couponRedemptions.couponId} = ${couponId} AND ${couponRedemptions.businessId} = ${businessId}`
      )
      .orderBy(desc(couponRedemptions.createdAt));
  }

  async getContactRedemptions(contactId: number): Promise<ContactRedemption[]> {
    const businessId = this.requireBusinessId();
    return await db
      .select({
        id: couponRedemptions.id,
        couponId: couponRedemptions.couponId,
        note: couponRedemptions.note,
        createdAt: couponRedemptions.createdAt,
        code: coupons.code,
      })
      .from(couponRedemptions)
      .innerJoin(coupons, eq(couponRedemptions.couponId, coupons.id))
      .where(
        sql`${couponRedemptions.contactId} = ${contactId} AND ${couponRedemptions.businessId} = ${businessId}`
      )
      .orderBy(desc(couponRedemptions.createdAt));
  }

  async searchCoupons(filters: {
    search?: string;
    status?: string;
    type?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<Coupon[]> {
    const clauses = [] as any[];
    if (filters.search) {
      clauses.push(sql`${coupons.code} ILIKE ${"%" + filters.search + "%"}`);
    }
    if (filters.type && filters.type !== "all") {
      clauses.push(sql`${coupons.type} = ${filters.type}`);
    }
    if (filters.startDate) {
      clauses.push(sql`${coupons.expirationDate} >= ${filters.startDate}`);
    }
    if (filters.endDate) {
      clauses.push(sql`${coupons.expirationDate} <= ${filters.endDate}`);
    }
    let whereClause = undefined as any;
    if (clauses.length === 1) {
      whereClause = clauses[0];
    } else if (clauses.length > 1) {
      const [first, ...rest] = clauses;
      whereClause = rest.reduce((acc, curr) => sql`${acc} AND ${curr}`, first);
    }

    const businessId = this.requireBusinessId();
    const base = db.select().from(coupons);
    const businessClause = sql`${coupons.businessId} = ${businessId}`;
    whereClause = whereClause
      ? sql`${whereClause} AND ${businessClause}`
      : businessClause;
    const rows = await base.where(whereClause).orderBy(desc(coupons.createdAt));
    const normalized = rows.map((c) => this.normalizeCouponStatus(c));
    if (filters.status && filters.status !== "all") {
      return normalized.filter((c) => c.status === filters.status);
    }
    return normalized;
  }

  // Messages
  async getMessages(): Promise<Message[]> {
    const businessId = this.requireBusinessId();
    return await db
      .select()
      .from(messages)
      .where(eq(messages.businessId, businessId))
      .orderBy(desc(messages.createdAt));
  }

  async getBillingFailures(): Promise<Message[]> {
    const businessId = this.requireBusinessId();
    return await db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.businessId, businessId),
          eq(messages.billingStatus, "failed")
        )
      )
      .orderBy(desc(messages.createdAt));
  }

  async getMessagesByCampaign(campaignId: number): Promise<Message[]> {
    const businessId = this.requireBusinessId();
    return await db
      .select()
      .from(messages)
      .where(
        sql`${messages.campaignId} = ${campaignId} AND ${messages.businessId} = ${businessId}`
      )
      .orderBy(desc(messages.createdAt));
  }

  async getMessagesByContact(contactId: number): Promise<Message[]> {
    const businessId = this.requireBusinessId();
    return await db
      .select()
      .from(messages)
      .where(
        sql`${messages.contactId} = ${contactId} AND ${messages.businessId} = ${businessId}`
      )
      .orderBy(asc(messages.createdAt));
  }

  async getConversationSummaries(): Promise<any[]> {
    const businessId = this.requireBusinessId();
    const contactsList = await this.getContacts();

    // Only get messages that represent actual conversations (received or regular messages)
    // Filter out initial/campaign messages that shouldn't create conversations
    const conversationMessages = await db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.businessId, businessId),
          sql`${messages.messageType} IN ('received', 'regular')`,
          // Only include messages with valid contactId (exclude test messages)
          sql`${messages.contactId} IS NOT NULL`
        )
      )
      .orderBy(desc(messages.createdAt));

    const seen = new Set<number>();
    const summaries: any[] = [];
    for (const msg of conversationMessages) {
      // Skip messages without contactId (shouldn't happen due to WHERE clause, but safety check)
      if (!msg.contactId) continue;

      if (seen.has(msg.contactId)) continue;
      const contact = contactsList.find((c) => c.id === msg.contactId);
      if (contact) {
        summaries.push({
          id: contact.id,
          firstName: contact.firstName,
          lastName: contact.lastName,
          phoneNumber: contact.phoneNumber,
          active: contact.active,
          lastMessage: msg,
        });
        seen.add(msg.contactId);
      }
    }
    return summaries;
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const businessId = this.requireBusinessId();
    const [newMessage] = await db
      .insert(messages)
      .values({ ...message, businessId })
      .returning();
    return newMessage;
  }

  async updateMessageStatus(
    id: number,
    status: string,
    deliveredAt?: Date,
    errorCode?: number
  ): Promise<Message> {
    const businessId = this.requireBusinessId();
    const [existing] = await db
      .select()
      .from(messages)
      .where(
        sql`${messages.id} = ${id} AND ${messages.businessId} = ${businessId}`
      )
      .limit(1);

    if (!existing) {
      throw new Error("Message not found");
    }

    if (existing.status === status) {
      return existing;
    }

    const updateData: any = { status };
    if (deliveredAt) {
      updateData.deliveredAt = deliveredAt;
    }
    if (errorCode !== undefined) {
      updateData.errorCode = errorCode;
    }
    if (status === "sent") {
      updateData.sentAt = new Date();
    }

    const [updatedMessage] = await db
      .update(messages)
      .set(updateData)
      .where(
        sql`${messages.id} = ${id} AND ${messages.businessId} = ${businessId}`
      )
      .returning();

    if (existing && existing.campaignId) {
      if (existing.status !== "sent" && status === "sent") {
        await db
          .update(campaigns)
          .set({ sentCount: sql`${campaigns.sentCount} + 1` })
          .where(
            sql`${campaigns.id} = ${existing.campaignId} AND ${campaigns.businessId} = ${businessId}`
          );
      }
      if (existing.status !== "delivered" && status === "delivered") {
        await db
          .update(campaigns)
          .set({ deliveredCount: sql`${campaigns.deliveredCount} + 1` })
          .where(
            sql`${campaigns.id} = ${existing.campaignId} AND ${campaigns.businessId} = ${businessId}`
          );
      } else if (existing.status === "delivered" && status !== "delivered") {
        await db
          .update(campaigns)
          .set({ deliveredCount: sql`${campaigns.deliveredCount} - 1` })
          .where(
            sql`${campaigns.id} = ${existing.campaignId} AND ${campaigns.businessId} = ${businessId}`
          );
      }

      const [total] = await db
        .select({ count: count() })
        .from(messages)
        .where(
          sql`${messages.campaignId} = ${existing.campaignId} AND ${messages.businessId} = ${businessId}`
        );
      const [terminal] = await db
        .select({ count: count() })
        .from(messages)
        .where(
          sql`${messages.campaignId} = ${existing.campaignId} AND ${messages.businessId} = ${businessId} AND ${messages.status} IN ('sent','delivered','failed')`
        );

      if (total.count > 0 && terminal.count === total.count) {
        const [failedCount] = await db
          .select({ count: count() })
          .from(messages)
          .where(
            sql`${messages.campaignId} = ${existing.campaignId} AND ${messages.businessId} = ${businessId} AND ${messages.status} = 'failed'`
          );

        const failureRate = failedCount.count / total.count;
        const newStatus = failureRate >= 0.8 ? "failed" : "completed";
        await db
          .update(campaigns)
          .set({ status: newStatus })
          .where(
            sql`${campaigns.id} = ${existing.campaignId} AND ${campaigns.businessId} = ${businessId}`
          );
      }
    }

    return updatedMessage;
  }

  async updateMessageStatusBySid(
    sid: string,
    status: string,
    errorCode?: number
  ): Promise<Message | undefined> {
    const businessId = this.requireBusinessId();
    const [row] = await db
      .select({ id: messages.id })
      .from(messages)
      .where(
        sql`${messages.messageSid} = ${sid} AND ${messages.businessId} = ${businessId}`
      );
    if (!row) return undefined;
    return this.updateMessageStatus(
      row.id,
      status,
      status === "delivered" ? new Date() : undefined,
      errorCode
    );
  }

  // Analytics
  async getDashboardStats(): Promise<{
    totalContacts: number;
    messagesSent: number;
    activeCampaigns: number;
    deliveryRate: number;
    contactsChange: number | null;
    messagesChange: number | null;
    campaignsChange: number | null;
    deliveryRateChange: number | null;
  }> {
    const businessId = this.requireBusinessId();
    const contactStats = await this.getContactStats();
    const contactsCount = { count: contactStats.allContacts };
    const [messagesCount] = await db
      .select({ count: count() })
      .from(messages)
      .where(
        sql`${messages.status} IN ('sent', 'delivered') AND ${messages.businessId} = ${businessId}`
      );

    const [totalCampaigns] = await db
      .select({ count: count() })
      .from(campaigns)
      .where(eq(campaigns.businessId, businessId));

    const inProgressWhere = sql`${campaigns.status} = 'in_progress' AND ${campaigns.businessId} = ${businessId}`;
    const [inProgressCampaigns] = await db
      .select({ count: count() })
      .from(campaigns)
      .where(inProgressWhere);

    const [deliveredCount] = await db
      .select({ count: count() })
      .from(messages)
      .where(
        sql`${messages.status} = 'delivered' AND ${messages.businessId} = ${businessId}`
      );
    const [totalSentCount] = await db
      .select({ count: count() })
      .from(messages)
      .where(
        sql`${messages.status} IN ('sent', 'delivered') AND ${messages.businessId} = ${businessId}`
      );

    const deliveryRate =
      totalSentCount.count > 0
        ? (deliveredCount.count / totalSentCount.count) * 100
        : 0;

    const now = new Date();

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const startOfPrevWeek = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [contactsThisMonth] = await db
      .select({ count: count() })
      .from(contacts)
      .where(
        sql`${contacts.createdAt} >= ${startOfMonth} AND ${contacts.businessId} = ${businessId}`
      );
    const [contactsLastMonth] = await db
      .select({ count: count() })
      .from(contacts)
      .where(
        sql`${contacts.createdAt} >= ${startOfLastMonth} AND ${contacts.createdAt} < ${startOfMonth} AND ${contacts.businessId} = ${businessId}`
      );

    const [messagesThisWeek] = await db
      .select({ count: count() })
      .from(messages)
      .where(
        sql`${messages.sentAt} >= ${startOfWeek} AND ${messages.status} IN ('sent', 'delivered') AND ${messages.businessId} = ${businessId}`
      );
    const [messagesLastWeek] = await db
      .select({ count: count() })
      .from(messages)
      .where(
        sql`${messages.sentAt} >= ${startOfPrevWeek} AND ${messages.sentAt} < ${startOfWeek} AND ${messages.status} IN ('sent', 'delivered') AND ${messages.businessId} = ${businessId}`
      );

    const [deliveredThisWeek] = await db
      .select({ count: count() })
      .from(messages)
      .where(
        sql`${messages.sentAt} >= ${startOfWeek} AND ${messages.status} = 'delivered' AND ${messages.businessId} = ${businessId}`
      );
    const [sentThisWeek] = await db
      .select({ count: count() })
      .from(messages)
      .where(
        sql`${messages.sentAt} >= ${startOfWeek} AND ${messages.status} IN ('sent', 'delivered') AND ${messages.businessId} = ${businessId}`
      );
    const [deliveredLastWeek] = await db
      .select({ count: count() })
      .from(messages)
      .where(
        sql`${messages.sentAt} >= ${startOfPrevWeek} AND ${messages.sentAt} < ${startOfWeek} AND ${messages.status} = 'delivered' AND ${messages.businessId} = ${businessId}`
      );
    const [sentLastWeek] = await db
      .select({ count: count() })
      .from(messages)
      .where(
        sql`${messages.sentAt} >= ${startOfPrevWeek} AND ${messages.sentAt} < ${startOfWeek} AND ${messages.status} IN ('sent', 'delivered') AND ${messages.businessId} = ${businessId}`
      );

    const contactsChange =
      contactsLastMonth.count > 0
        ? ((contactsThisMonth.count - contactsLastMonth.count) /
            contactsLastMonth.count) *
          100
        : null;
    const messagesChange =
      messagesLastWeek.count > 0
        ? ((messagesThisWeek.count - messagesLastWeek.count) /
            messagesLastWeek.count) *
          100
        : null;
    const campaignsChange =
      totalCampaigns.count > 0
        ? (inProgressCampaigns.count / totalCampaigns.count) * 100
        : null;

    const currentDeliveryRate =
      sentThisWeek.count > 0
        ? (deliveredThisWeek.count / sentThisWeek.count) * 100
        : 0;
    const lastDeliveryRate =
      sentLastWeek.count > 0
        ? (deliveredLastWeek.count / sentLastWeek.count) * 100
        : 0;
    const deliveryRateChange =
      sentLastWeek.count > 0 ? currentDeliveryRate - lastDeliveryRate : null;

    return {
      totalContacts: contactsCount.count,
      messagesSent: messagesCount.count,
      activeCampaigns: inProgressCampaigns.count,
      deliveryRate: Math.round(deliveryRate * 100) / 100,
      contactsChange:
        contactsChange === null ? null : Math.round(contactsChange * 100) / 100,
      messagesChange:
        messagesChange === null ? null : Math.round(messagesChange * 100) / 100,
      campaignsChange:
        campaignsChange === null
          ? null
          : Math.round(campaignsChange * 100) / 100,
      deliveryRateChange:
        deliveryRateChange === null
          ? null
          : Math.round(deliveryRateChange * 100) / 100,
    };
  }

  async getContactStats(): Promise<{
    allContacts: number;
  }> {
    const businessId = this.requireBusinessId();
    const [allContacts] = await db
      .select({ count: count() })
      .from(contacts)
      .where(eq(contacts.businessId, businessId));
    return { allContacts: allContacts.count };
  }

  async getCouponStats(): Promise<{
    allCoupons: number;
  }> {
    const businessId = this.requireBusinessId();
    const [allCoupons] = await db
      .select({ count: count() })
      .from(coupons)
      .where(eq(coupons.businessId, businessId));
    return { allCoupons: allCoupons.count };
  }

  async getCampaignStats(): Promise<{
    activeCampaigns: number;
    campaignsThisMonth: number;
    scheduledCampaigns: number;
  }> {
    const businessId = this.requireBusinessId();

    // Get in-progress campaigns
    const [activeCampaigns] = await db
      .select({ count: count() })
      .from(campaigns)
      .where(
        sql`${campaigns.status} = 'in_progress' AND ${campaigns.businessId} = ${businessId}`
      );

    // Get campaigns created this month
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const [campaignsThisMonth] = await db
      .select({ count: count() })
      .from(campaigns)
      .where(
        sql`${campaigns.createdAt} >= ${firstDayOfMonth} AND ${campaigns.businessId} = ${businessId}`
      );

    // Get scheduled campaigns
    const [scheduledCampaigns] = await db
      .select({ count: count() })
      .from(campaigns)
      .where(
        sql`${campaigns.status} = 'scheduled' AND ${campaigns.businessId} = ${businessId}`
      );

    return {
      activeCampaigns: activeCampaigns.count,
      campaignsThisMonth: campaignsThisMonth.count,
      scheduledCampaigns: scheduledCampaigns.count,
    };
  }

  async getAnalytics(
    range: "thisMonth" | "lastMonth" | "thisWeek" | "lastWeek"
  ): Promise<Analytics[]> {
    const businessId = this.requireBusinessId();
    const now = new Date();
    let start: Date;
    let end = new Date();
    switch (range) {
      case "thisMonth":
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "lastMonth":
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "thisWeek":
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "lastWeek":
        start = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        end = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      default:
        start = new Date(0);
        break;
    }

    return await db
      .select()
      .from(analytics)
      .where(
        sql`${analytics.businessId} = ${businessId} AND ${analytics.date} >= ${start} AND ${analytics.date} < ${end}`
      )
      .orderBy(desc(analytics.date));
  }

  async createBusiness(business: InsertBusiness): Promise<Business> {
    const [row] = await db.insert(businesses).values(business).returning();

    // Grant 50 free trial credits if the business is created with "free_trial" plan
    if (row.plan === "free_trial") {
      try {
        const biz = this.forBusiness(row.id);
        await biz.adjustCredits(
          50,
          "trial_bonus",
          "Free trial credits for new business"
        );
      } catch (error) {
        // Log error but don't fail business creation
        logError("Failed to grant trial credits", {
          businessId: row.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return row;
  }

  async updateBusiness(business: Partial<InsertBusiness>): Promise<Business> {
    const businessId = this.requireBusinessId();
    const [row] = await db
      .update(businesses)
      .set(business)
      .where(eq(businesses.id, businessId))
      .returning();
    return row;
  }

  async getBusiness(): Promise<Business> {
    const businessId = this.requireBusinessId();
    const [row] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.id, businessId));
    return row as Business;
  }

  async getBusinessProfile(): Promise<BusinessProfile | undefined> {
    const businessId = this.requireBusinessId();
    const [profile] = await db
      .select()
      .from(businessProfiles)
      .where(eq(businessProfiles.businessId, businessId));
    return profile || undefined;
  }

  async upsertBusinessProfile(
    profile: InsertBusinessProfile
  ): Promise<BusinessProfile> {
    const businessId = this.requireBusinessId();
    const existing = await this.getBusinessProfile();
    if (existing) {
      const [row] = await db
        .update(businessProfiles)
        .set({ ...profile, updatedAt: new Date() })
        .where(eq(businessProfiles.businessId, businessId))
        .returning();
      return row;
    }
    const [row] = await db
      .insert(businessProfiles)
      .values({ ...profile, businessId })
      .returning();
    return row;
  }

  async getTwilioCredentials(): Promise<TwilioCredential | undefined> {
    const businessId = this.requireBusinessId();
    const [row] = await db
      .select()
      .from(twilioCredentials)
      .where(eq(twilioCredentials.businessId, businessId));
    return row || undefined;
  }

  async upsertTwilioCredentials(
    creds: InsertTwilioCredential & { messagingServiceSid?: string }
  ): Promise<TwilioCredential> {
    const businessId = this.requireBusinessId();
    const existing = await this.getTwilioCredentials();

    // Ensure we're using the centralized account SID from environment
    const centralizedCreds = {
      ...creds,
      accountSid: process.env.TWILIO_ACCOUNT_SID || creds.accountSid,
    };

    if (existing) {
      const [row] = await db
        .update(twilioCredentials)
        .set({ ...centralizedCreds, updatedAt: new Date() })
        .where(eq(twilioCredentials.businessId, businessId))
        .returning();
      return row;
    }
    const [row] = await db
      .insert(twilioCredentials)
      .values({ ...centralizedCreds, businessId })
      .returning();
    return row;
  }

  // New messaging service management methods
  async getMessagingServiceSid(): Promise<string | undefined> {
    const businessId = this.requireBusinessId();

    // First check the businesses table (new approach)
    const business = await this.getBusiness();
    if (business.messagingServiceSid) {
      return business.messagingServiceSid;
    }

    // Fallback to twilioCredentials table for backward compatibility
    const creds = await this.getTwilioCredentials();
    return creds?.messagingServiceSid ?? undefined;
  }

  async setMessagingServiceSid(serviceSid: string): Promise<Business> {
    const businessId = this.requireBusinessId();
    const [updatedBusiness] = await db
      .update(businesses)
      .set({ messagingServiceSid: serviceSid })
      .where(eq(businesses.id, businessId))
      .returning();
    return updatedBusiness;
  }

  async ensureMessagingServiceSid(): Promise<string> {
    // First try to get existing messaging service SID
    const existing = await this.getMessagingServiceSid();
    if (existing) {
      return existing;
    }

    // If none exists, we need to create one via the Twilio service
    // This will be called from the routes where we have access to the Twilio client
    throw new Error("No messaging service SID found - needs to be created");
  }

  async getPhoneNumbers(): Promise<BusinessPhoneNumber[]> {
    const businessId = this.requireBusinessId();
    return await db
      .select()
      .from(businessPhoneNumbers)
      .where(eq(businessPhoneNumbers.businessId, businessId))
      .orderBy(desc(businessPhoneNumbers.createdAt));
  }

  async setPhoneNumbers(
    numbers: InsertBusinessPhoneNumber[]
  ): Promise<BusinessPhoneNumber[]> {
    const businessId = this.requireBusinessId();
    await db
      .delete(businessPhoneNumbers)
      .where(eq(businessPhoneNumbers.businessId, businessId));
    if (numbers.length === 0) return [];
    const rows = await db
      .insert(businessPhoneNumbers)
      .values(numbers.map((n) => ({ ...n, businessId })))
      .returning();
    return rows;
  }

  async updatePhoneNumberTFV(
    phoneNumberId: number,
    tfvSid: string,
    verificationStatus: string
  ): Promise<BusinessPhoneNumber> {
    const businessId = this.requireBusinessId();
    const [updatedPhoneNumber] = await db
      .update(businessPhoneNumbers)
      .set({
        tfvSid,
        verificationStatus,
        updatedAt: new Date(),
      })
      .where(
        sql`${businessPhoneNumbers.id} = ${phoneNumberId} AND ${businessPhoneNumbers.businessId} = ${businessId}`
      )
      .returning();
    return updatedPhoneNumber;
  }

  async getTFVVerificationStatus(): Promise<{
    isVerified: boolean;
    status: string;
    hasPhoneNumbers: boolean;
    pendingTFVs: Array<{ tfvSid: string; phoneNumber: string }>;
  }> {
    const businessId = this.requireBusinessId();
    const phoneNumbers = await db
      .select()
      .from(businessPhoneNumbers)
      .where(eq(businessPhoneNumbers.businessId, businessId));

    if (phoneNumbers.length === 0) {
      return {
        isVerified: false,
        status: "no_phone_numbers",
        hasPhoneNumbers: false,
        pendingTFVs: [],
      };
    }

    // Check if any phone number is verified - USE CORRECT TWILIO STATUS VALUES
    const verifiedNumbers = phoneNumbers.filter(
      (phone) => phone.verificationStatus === "TWILIO_APPROVED" // ✅ CORRECT
    );

    const pendingTFVs = phoneNumbers
      .filter(
        (phone) => phone.tfvSid && phone.verificationStatus === "PENDING_REVIEW"
      ) // ✅ CORRECT
      .map((phone) => ({
        tfvSid: phone.tfvSid!,
        phoneNumber: phone.phoneNumber,
      }));

    // Business is considered verified if at least one phone number is verified
    const isVerified = verifiedNumbers.length > 0;

    let status = "PENDING_REVIEW"; // ✅ CORRECT
    if (isVerified) {
      status = "TWILIO_APPROVED"; // ✅ CORRECT
    } else if (
      phoneNumbers.some(
        (phone) => phone.verificationStatus === "TWILIO_REJECTED"
      ) // ✅ CORRECT
    ) {
      status = "TWILIO_REJECTED"; // ✅ CORRECT
    } else if (phoneNumbers.some((phone) => phone.tfvSid)) {
      status = "PENDING_REVIEW"; // ✅ CORRECT
    } else {
      status = "not_submitted";
    }

    return {
      isVerified,
      status,
      hasPhoneNumbers: true,
      pendingTFVs,
    };
  }

  async refreshTFVStatusFromTwilio(): Promise<void> {
    const businessId = this.requireBusinessId();
    const phoneNumbers = await db
      .select()
      .from(businessPhoneNumbers)
      .where(eq(businessPhoneNumbers.businessId, businessId));

    // Import getTollFreeVerificationStatus dynamically to avoid circular dependencies
    const { getTollFreeVerificationStatus } = await import(
      "../services/tfv.js"
    );

    for (const phoneNumber of phoneNumbers) {
      if (
        phoneNumber.tfvSid &&
        phoneNumber.verificationStatus === "PENDING_REVIEW"
      ) {
        // ✅ CORRECT
        try {
          const tfvStatus = await getTollFreeVerificationStatus(
            phoneNumber.tfvSid
          );

          // Only update if status has changed
          if (tfvStatus.status !== phoneNumber.verificationStatus) {
            await db
              .update(businessPhoneNumbers)
              .set({
                verificationStatus: tfvStatus.status,
                updatedAt: new Date(),
              })
              .where(eq(businessPhoneNumbers.id, phoneNumber.id));
          }
        } catch (error) {
          logError(
            `Failed to refresh TFV status for ${phoneNumber.tfvSid}:`,
            error
          );
          // Continue with other phone numbers even if one fails
        }
      }
    }
  }

  async getTwilioA2PConfig(): Promise<TwilioA2pConfig | undefined> {
    const businessId = this.requireBusinessId();
    const [row] = await db
      .select()
      .from(messagingConfigs)
      .where(eq(messagingConfigs.businessId, businessId));
    return row || undefined;
  }

  async upsertTwilioA2PConfig(
    config: InsertTwilioA2pConfig
  ): Promise<TwilioA2pConfig> {
    const businessId = this.requireBusinessId();
    const existing = await this.getTwilioA2PConfig();
    if (existing) {
      const [row] = await db
        .update(messagingConfigs)
        .set({ ...config, updatedAt: new Date() })
        .where(eq(messagingConfigs.businessId, businessId))
        .returning();
      return row;
    }
    const [row] = await db
      .insert(messagingConfigs)
      .values({ ...config, businessId })
      .returning();
    return row;
  }

  // Users
  // These lookup helpers are allowed to bypass tenant scoping
  // so authentication can look up a user before the business
  // context has been established.
  async getUserByUsername(username: string): Promise<User | undefined> {
    const base = db.select().from(users);
    const q =
      this.businessId !== undefined
        ? base.where(
            sql`${users.username} = ${username} AND ${users.businessId} = ${this.businessId}`
          )
        : base.where(eq(users.username, username));
    const [user] = await q;
    return user || undefined;
  }

  async getUserById(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByClerkId(clerkId: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.clerkId, clerkId));
    return user || undefined;
  }

  async createUser(user: InsertUser): Promise<User> {
    const businessId = this.requireBusinessId();
    const [newUser] = await db
      .insert(users)
      .values({ ...user, businessId })
      .returning();
    return newUser;
  }

  // Credits
  async getCredits(): Promise<BusinessCredit | undefined> {
    const businessId = this.requireBusinessId();
    const [credits] = await db
      .select()
      .from(businessCredits)
      .where(eq(businessCredits.businessId, businessId));
    return credits || undefined;
  }

  async adjustCredits(
    amount: number,
    type: string,
    description?: string,
    metadata?: Record<string, any>
  ): Promise<BusinessCredit> {
    const businessId = this.requireBusinessId();

    return await db.transaction(async (tx) => {
      // Get or create business credits record
      let [credits] = await tx
        .select()
        .from(businessCredits)
        .where(eq(businessCredits.businessId, businessId));

      if (!credits) {
        // Create initial credits record
        [credits] = await tx
          .insert(businessCredits)
          .values({
            businessId,
            balance: 0,
            updatedAt: new Date(),
          })
          .returning();
      }

      // Update balance
      const newBalance = credits.balance + amount;
      if (newBalance < 0) {
        throw new Error("Insufficient credits");
      }

      const [updatedCredits] = await tx
        .update(businessCredits)
        .set({
          balance: newBalance,
          updatedAt: new Date(),
        })
        .where(eq(businessCredits.businessId, businessId))
        .returning();

      // Record transaction
      await tx.insert(creditTransactions).values({
        businessId,
        type,
        amount,
        description,
        metadata: metadata ? JSON.stringify(metadata) : null,
      });

      return updatedCredits;
    });
  }

  async getCreditTransactions(): Promise<CreditTransaction[]> {
    const businessId = this.requireBusinessId();
    return await db
      .select()
      .from(creditTransactions)
      .where(eq(creditTransactions.businessId, businessId))
      .orderBy(desc(creditTransactions.createdAt));
  }

  // Onboarding Progress
  async getOnboardingProgress(): Promise<OnboardingProgress | undefined> {
    const businessId = this.requireBusinessId();
    const [progress] = await db
      .select()
      .from(onboardingProgress)
      .where(eq(onboardingProgress.businessId, businessId));
    return progress || undefined;
  }

  async upsertOnboardingProgress(
    progress: InsertOnboardingProgress
  ): Promise<OnboardingProgress> {
    const businessId = this.requireBusinessId();
    const existing = await this.getOnboardingProgress();
    if (existing) {
      const [row] = await db
        .update(onboardingProgress)
        .set({ ...progress, updatedAt: new Date() })
        .where(eq(onboardingProgress.businessId, businessId))
        .returning();
      return row;
    }
    const [row] = await db
      .insert(onboardingProgress)
      .values({ ...progress, businessId })
      .returning();
    return row;
  }

  // Subscription Management
  async getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    return await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.isActive, true))
      .orderBy(asc(subscriptionPlans.priceMonthly));
  }

  async getSubscriptionPlan(
    name: string
  ): Promise<SubscriptionPlan | undefined> {
    const [plan] = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.name, name));
    return plan || undefined;
  }

  async updateBusinessPlan(
    plan: string,
    stripeCustomerId?: string,
    stripeSubscriptionId?: string,
    trialVoidedAt?: Date
  ): Promise<Business> {
    const businessId = this.requireBusinessId();

    const updateData: any = {
      plan,
      stripeCustomerId,
      stripeSubscriptionId,
    };

    // If voiding trial, mark it as used and set voided timestamp
    if (trialVoidedAt) {
      updateData.trialUsed = true;
      updateData.trialVoidedAt = trialVoidedAt;
      updateData.trialEndsAt = trialVoidedAt; // Also end the trial period
    }

    const [row] = await db
      .update(businesses)
      .set(updateData)
      .where(eq(businesses.id, businessId))
      .returning();
    return row as Business;
  }

  async recordSubscriptionEvent(
    eventType: string,
    stripeEventId?: string,
    metadata?: Record<string, any>
  ): Promise<SubscriptionEvent> {
    const businessId = this.requireBusinessId();
    const [row] = await db
      .insert(subscriptionEvents)
      .values({
        businessId,
        eventType,
        stripeEventId,
        metadata: metadata ? JSON.stringify(metadata) : null,
      })
      .returning();
    return row as SubscriptionEvent;
  }

  async getSubscriptionEvents(): Promise<SubscriptionEvent[]> {
    const businessId = this.requireBusinessId();
    return await db
      .select()
      .from(subscriptionEvents)
      .where(eq(subscriptionEvents.businessId, businessId))
      .orderBy(desc(subscriptionEvents.createdAt));
  }

  // Recent Activity
  async getRecentContacts(limit?: number): Promise<Contact[]> {
    const businessId = this.requireBusinessId();
    const recentContacts = await db
      .select()
      .from(contacts)
      .where(eq(contacts.businessId, businessId))
      .orderBy(desc(contacts.createdAt));

    return limit ? recentContacts.slice(0, limit) : recentContacts;
  }

  async getRecentCampaigns(limit?: number): Promise<RecentCampaign[]> {
    const businessId = this.requireBusinessId();
    const recentCampaigns = await db
      .select({
        id: campaigns.id,
        name: campaigns.name,
        status: campaigns.status,
        createdAt: campaigns.createdAt,
      })
      .from(campaigns)
      .where(eq(campaigns.businessId, businessId))
      .orderBy(desc(campaigns.createdAt));

    // Convert to RecentCampaign format with string dates
    const formattedCampaigns = recentCampaigns.map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      createdAt: campaign.createdAt.toISOString(),
    }));

    return limit ? formattedCampaigns.slice(0, limit) : formattedCampaigns;
  }

  async getRecentMessages(limit?: number): Promise<Message[]> {
    const businessId = this.requireBusinessId();
    const recentMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.businessId, businessId))
      .orderBy(desc(messages.createdAt));

    return limit ? recentMessages.slice(0, limit) : recentMessages;
  }

  async getRecentInboxMessages(limit?: number): Promise<Message[]> {
    const businessId = this.requireBusinessId();
    const recentInboxMessages = await db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.businessId, businessId),
          eq(messages.status, "received")
        )
      )
      .orderBy(desc(messages.createdAt));

    return limit ? recentInboxMessages.slice(0, limit) : recentInboxMessages;
  }

  // SMS Command Pending Management Implementation
  async storePendingSMSCommand(
    data: InsertSmsCommandPending
  ): Promise<SmsCommandPending> {
    const businessId = this.requireBusinessId();

    // Use UPSERT to ensure only one pending command per business
    const [pending] = await db
      .insert(smsCommandPending)
      .values({
        businessId,
        ...data,
      })
      .onConflictDoUpdate({
        target: smsCommandPending.businessId,
        set: {
          senderPhone: data.senderPhone,
          messageContent: data.messageContent,
          contactCount: data.contactCount,
          creditCost: data.creditCost,
          expiresAt: data.expiresAt,
          createdAt: new Date(),
        },
      })
      .returning();

    return pending;
  }

  async getPendingSMSCommand(
    businessId: number
  ): Promise<SmsCommandPending | null> {
    const [pending] = await db
      .select()
      .from(smsCommandPending)
      .where(eq(smsCommandPending.businessId, businessId));

    return pending || null;
  }

  async clearPendingSMSCommand(businessId: number): Promise<void> {
    await db
      .delete(smsCommandPending)
      .where(eq(smsCommandPending.businessId, businessId));
  }

  async cleanupExpiredSMSCommands(): Promise<number> {
    const now = new Date();
    const deleted = await db
      .delete(smsCommandPending)
      .where(sql`${smsCommandPending.expiresAt} < ${now}`)
      .returning({ id: smsCommandPending.id });

    return deleted.length;
  }
}

export const storage = new DatabaseStorage();

export async function findBusinessIdByPhoneNumber(
  phoneNumber: string
): Promise<number | undefined> {
  const normalized = normalizePhoneNumber(phoneNumber);
  const [row] = await db
    .select({ businessId: businessPhoneNumbers.businessId })
    .from(businessPhoneNumbers)
    .where(eq(businessPhoneNumbers.phoneNumber, normalized));
  return row?.businessId;
}
