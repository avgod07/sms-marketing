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
} from "@shared/schema";
import type { ContactRedemption } from "@shared/api-types";
import { db } from "./db";
import { eq, desc, count, sql } from "drizzle-orm";
import { normalizePhoneNumber } from "./phone";
import { logError } from "./logger";

export interface IStorage {
  forBusiness(businessId: number): IStorage;
  createBusiness(business: InsertBusiness): Promise<Business>;
  updateBusiness(business: Partial<InsertBusiness>): Promise<Business>;
  getBusiness(): Promise<Business>;
  getBusinessProfile(): Promise<BusinessProfile | undefined>;
  upsertBusinessProfile(profile: InsertBusinessProfile): Promise<BusinessProfile>;
  // Twilio
  getTwilioCredentials(): Promise<TwilioCredential | undefined>;
  upsertTwilioCredentials(
    creds: InsertTwilioCredential & { messagingServiceSid?: string }
  ): Promise<TwilioCredential>;
  getPhoneNumbers(): Promise<BusinessPhoneNumber[]>;
  setPhoneNumbers(numbers: InsertBusinessPhoneNumber[]): Promise<BusinessPhoneNumber[]>;
  // Contacts
  getContacts(): Promise<Contact[]>;
  getContactsBySegment(segment: string): Promise<Contact[]>;
  getContactsByStatus(status: string): Promise<Contact[]>;
  getContact(id: number): Promise<Contact | undefined>;
  getContactByPhoneNumber(phoneNumber: string): Promise<Contact | undefined>;
  createContact(contact: InsertContact): Promise<Contact>;
  updateContact(id: number, contact: Partial<InsertContact>): Promise<Contact>;
  deleteContact(id: number): Promise<void>;
  searchContacts(query: string, status?: string): Promise<Contact[]>;

  // Campaigns
  getCampaigns(): Promise<Campaign[]>;
  getCampaign(id: number): Promise<Campaign | undefined>;
  createCampaign(campaign: InsertCampaign): Promise<Campaign>;
  updateCampaign(id: number, campaign: Partial<Campaign>): Promise<Campaign>;
  deleteCampaign(id: number): Promise<void>;
  normalizeCampaignStatuses(): Promise<void>;

  // Coupons
  getCoupons(): Promise<Coupon[]>;
  getCoupon(id: number): Promise<Coupon | undefined>;
  getCouponByCode(code: string): Promise<Coupon | undefined>;
  createCoupon(coupon: InsertCoupon): Promise<Coupon>;
  updateCoupon(id: number, coupon: Partial<Coupon>): Promise<Coupon>;
  deleteCoupon(id: number): Promise<void>;
  createCouponRedemption(
    redemption: InsertCouponRedemption,
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
    recipient: InsertCouponRecipient,
  ): Promise<CouponRecipient>;
  hasContactReceivedCoupon(
    contactId: number,
    couponCode: string,
  ): Promise<boolean>;
  hasContactRedeemedCoupon(
    contactId: number,
    couponId: number,
  ): Promise<boolean>;

  // Messages
  getMessages(): Promise<Message[]>;
  getMessagesByCampaign(campaignId: number): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  updateMessageStatus(
    id: number,
    status: string,
    deliveredAt?: Date,
  ): Promise<Message>;

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
  getAnalytics(range: 'thisMonth' | 'lastMonth' | 'thisWeek' | 'lastWeek'): Promise<Analytics[]>;
  getContactStats(status?: string): Promise<{
    allContacts: number;
    inactive: number;
    activeContacts: number;
  }>;
  getCampaignStats(): Promise<{
    activeCampaigns: number;
    messagesThisMonth: number;
    avgClickRate: number;
  }>;

  // Users
  // The following fetchers are intentionally accessible without
  // scoping to a business. They are used during authentication
  // before the tenant context is known.
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserById(id: number): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
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
    const status = coupon.status === "active" && !isExpired ? "active" : "inactive";
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

  async getContactsBySegment(segment: string): Promise<Contact[]> {
    if (segment === "all") {
      return await this.getContacts();
    }
    if (segment === "inactive" || segment === "active") {
      const businessId = this.requireBusinessId();
      return await db
        .select()
        .from(contacts)
        .where(
          sql`${contacts.status} = ${segment} AND ${contacts.businessId} = ${businessId}`,
        )
        .orderBy(desc(contacts.createdAt));
    }
    const businessId = this.requireBusinessId();
    return await db
      .select()
      .from(contacts)
      .where(
        sql`${contacts.segment} = ${segment} AND ${contacts.businessId} = ${businessId}`,
      )
      .orderBy(desc(contacts.createdAt));
  }

  async getContactsByStatus(status: string): Promise<Contact[]> {
    if (status === "all") {
      return await this.getContacts();
    }
    const businessId = this.requireBusinessId();
    return await db
      .select()
      .from(contacts)
      .where(
        sql`${contacts.status} = ${status} AND ${contacts.businessId} = ${businessId}`,
      )
      .orderBy(desc(contacts.createdAt));
  }

  async getContact(id: number): Promise<Contact | undefined> {
    const businessId = this.requireBusinessId();
    const [contact] = await db
      .select()
      .from(contacts)
      .where(
        sql`${contacts.id} = ${id} AND ${contacts.businessId} = ${businessId}`,
      );
    return contact || undefined;
  }

  async createContact(contact: InsertContact): Promise<Contact> {
    const businessId = this.requireBusinessId();
    const [newContact] = await db
      .insert(contacts)
      .values({
        ...contact,
        businessId,
        updatedAt: new Date(),
      })
      .returning();
    return newContact;
  }

  async updateContact(
    id: number,
    contact: Partial<InsertContact>,
  ): Promise<Contact> {
    const businessId = this.requireBusinessId();
    const [updatedContact] = await db
      .update(contacts)
      .set({
        ...contact,
        updatedAt: new Date(),
      })
      .where(
        sql`${contacts.id} = ${id} AND ${contacts.businessId} = ${businessId}`,
      )
      .returning();
    return updatedContact;
  }

  async deleteContact(id: number): Promise<void> {
    const businessId = this.requireBusinessId();
    await db.transaction(async (tx) => {
      await tx
        .delete(messages)
        .where(sql`${messages.contactId} = ${id} AND ${messages.businessId} = ${businessId}`);
      await tx
        .delete(couponRecipients)
        .where(sql`${couponRecipients.contactId} = ${id} AND ${couponRecipients.businessId} = ${businessId}`);
      await tx
        .update(couponRedemptions)
        .set({ contactId: null })
        .where(sql`${couponRedemptions.contactId} = ${id} AND ${couponRedemptions.businessId} = ${businessId}`);
      await tx
        .delete(contacts)
        .where(sql`${contacts.id} = ${id} AND ${contacts.businessId} = ${businessId}`);
    });
  }

  async searchContacts(query: string, status?: string): Promise<Contact[]> {
    const searchSql = sql`${contacts.firstName} ILIKE ${"%" + query + "%"} OR ${contacts.lastName} ILIKE ${"%" + query + "%"} OR ${contacts.phoneNumber} ILIKE ${"%" + query + "%"} OR ${contacts.email} ILIKE ${"%" + query + "%"}`;
    const whereClause =
      status && status !== "all"
        ? sql`(${searchSql}) AND ${contacts.status} = ${status}`
        : searchSql;
    const businessId = this.requireBusinessId();
    return await db
      .select()
      .from(contacts)
      .where(sql`(${whereClause}) AND ${contacts.businessId} = ${businessId}`)
      .orderBy(desc(contacts.createdAt));
  }

  async getContactByPhoneNumber(
    phoneNumber: string,
  ): Promise<Contact | undefined> {
    const normalized = normalizePhoneNumber(phoneNumber);
    const businessId = this.requireBusinessId();
    const [contact] = await db
      .select()
      .from(contacts)
      .where(
        sql`${contacts.phoneNumber} = ${normalized} AND ${contacts.businessId} = ${businessId}`,
      );
    return contact || undefined;
  }

  async hasContactReceivedCoupon(
    contactId: number,
    couponCode: string,
  ): Promise<boolean> {
    const businessId = this.requireBusinessId();
    const [row] = await db
      .select({ id: couponRecipients.id })
      .from(couponRecipients)
      .innerJoin(coupons, eq(couponRecipients.couponId, coupons.id))
      .where(
        sql`${couponRecipients.contactId} = ${contactId} AND ${coupons.code} = ${couponCode} AND ${couponRecipients.businessId} = ${businessId}`,
      )
      .limit(1);
    return !!row;
  }

  async hasContactRedeemedCoupon(
    contactId: number,
    couponId: number,
  ): Promise<boolean> {
    const businessId = this.requireBusinessId();
    const [row] = await db
      .select({ id: couponRedemptions.id })
      .from(couponRedemptions)
      .where(
        sql`${couponRedemptions.contactId} = ${contactId} AND ${couponRedemptions.couponId} = ${couponId} AND ${couponRedemptions.businessId} = ${businessId}`,
      )
      .limit(1);
    return !!row;
  }

  // Campaigns
  async getCampaigns(): Promise<Campaign[]> {
    const businessId = this.requireBusinessId();
    return await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.businessId, businessId))
      .orderBy(desc(campaigns.createdAt));
  }

  async getCampaign(id: number): Promise<Campaign | undefined> {
    const businessId = this.requireBusinessId();
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(
        sql`${campaigns.id} = ${id} AND ${campaigns.businessId} = ${businessId}`,
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
    campaign: Partial<Campaign>,
  ): Promise<Campaign> {
    const businessId = this.requireBusinessId();
    const [updatedCampaign] = await db
      .update(campaigns)
      .set({
        ...campaign,
        updatedAt: new Date(),
      })
      .where(
        sql`${campaigns.id} = ${id} AND ${campaigns.businessId} = ${businessId}`,
      )
      .returning();
    return updatedCampaign;
  }

  async deleteCampaign(id: number): Promise<void> {
    const businessId = this.requireBusinessId();
    await db
      .delete(campaigns)
      .where(sql`${campaigns.id} = ${id} AND ${campaigns.businessId} = ${businessId}`);
  }

  async normalizeCampaignStatuses(): Promise<void> {
    const businessId = this.requireBusinessId();
    const whereActive = sql`${campaigns.status} IN ('active', 'paused') AND ${campaigns.businessId} = ${businessId}`;
    await db
      .update(campaigns)
      .set({ status: "in_progress", updatedAt: new Date() })
      .where(whereActive);

    const whereCompleted = sql`${campaigns.status} IN ('sent', 'finished') AND ${campaigns.businessId} = ${businessId}`;
    await db
      .update(campaigns)
      .set({ status: "completed", updatedAt: new Date() })
      .where(whereCompleted);
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
      .where(sql`${coupons.id} = ${id} AND ${coupons.businessId} = ${businessId}`);
    return coupon ? this.normalizeCouponStatus(coupon) : undefined;
  }

  async getCouponByCode(code: string): Promise<Coupon | undefined> {
    const businessId = this.requireBusinessId();
    const [coupon] = await db
      .select()
      .from(coupons)
      .where(
        sql`${coupons.code} = ${code} AND ${coupons.businessId} = ${businessId}`,
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

  async updateCoupon(
    id: number,
    coupon: Partial<Coupon>,
  ): Promise<Coupon> {
    const businessId = this.requireBusinessId();
    const [updatedCoupon] = await db
      .update(coupons)
      .set({
        ...coupon,
        updatedAt: new Date(),
      })
      .where(
        sql`${coupons.id} = ${id} AND ${coupons.businessId} = ${businessId}`,
      )
      .returning();
    return this.normalizeCouponStatus(updatedCoupon);
  }

  async deleteCoupon(id: number): Promise<void> {
    const businessId = this.requireBusinessId();
    await db
      .delete(coupons)
      .where(sql`${coupons.id} = ${id} AND ${coupons.businessId} = ${businessId}`);
  }

  async createCouponRedemption(
    redemption: InsertCouponRedemption,
  ): Promise<CouponRedemption> {
    const businessId = this.requireBusinessId();
    const [newRedemption] = await db
      .insert(couponRedemptions)
      .values({ ...redemption, businessId })
      .returning();
    return newRedemption;
  }

  async createCouponRecipient(
    recipient: InsertCouponRecipient,
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
        sql`${couponRedemptions.couponId} = ${couponId} AND ${couponRedemptions.businessId} = ${businessId}`,
      )
      .orderBy(desc(couponRedemptions.createdAt));
  }

  async getContactRedemptions(
    contactId: number,
  ): Promise<ContactRedemption[]> {
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
        sql`${couponRedemptions.contactId} = ${contactId} AND ${couponRedemptions.businessId} = ${businessId}`,
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
    const rows = await base
      .where(whereClause)
      .orderBy(desc(coupons.createdAt));
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

  async getMessagesByCampaign(campaignId: number): Promise<Message[]> {
    const businessId = this.requireBusinessId();
    return await db
      .select()
      .from(messages)
      .where(
        sql`${messages.campaignId} = ${campaignId} AND ${messages.businessId} = ${businessId}`,
      )
      .orderBy(desc(messages.createdAt));
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
  ): Promise<Message> {
    const updateData: any = { status };
    if (deliveredAt) {
      updateData.deliveredAt = deliveredAt;
    }
    if (status === "sent") {
      updateData.sentAt = new Date();
    }

    const [updatedMessage] = await db
      .update(messages)
      .set(updateData)
      .where(
        sql`${messages.id} = ${id} AND ${messages.businessId} = ${this.requireBusinessId()}`,
      )
      .returning();
    return updatedMessage;
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
        sql`${messages.status} IN ('sent', 'delivered') AND ${messages.businessId} = ${businessId}`,
      );

    const [totalCampaigns] = await db
      .select({ count: count() })
      .from(campaigns)
      .where(eq(campaigns.businessId, businessId));

    const now = new Date();
    const inProgressWhere = sql`(${campaigns.status} IN ('draft', 'scheduled', 'in_progress') OR (${campaigns.scheduledAt} IS NOT NULL AND ${campaigns.scheduledAt} > ${now})) AND ${campaigns.businessId} = ${businessId}`;
    const [inProgressCampaigns] = await db
      .select({ count: count() })
      .from(campaigns)
      .where(inProgressWhere);

    const [deliveredCount] = await db
      .select({ count: count() })
      .from(messages)
      .where(sql`${messages.status} = 'delivered' AND ${messages.businessId} = ${businessId}`);
    const [totalSentCount] = await db
      .select({ count: count() })
      .from(messages)
      .where(sql`${messages.status} IN ('sent', 'delivered') AND ${messages.businessId} = ${businessId}`);

    const deliveryRate =
      totalSentCount.count > 0
        ? (deliveredCount.count / totalSentCount.count) * 100
        : 0;

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const startOfPrevWeek = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [contactsThisMonth] = await db
      .select({ count: count() })
      .from(contacts)
      .where(sql`${contacts.createdAt} >= ${startOfMonth} AND ${contacts.businessId} = ${businessId}`);
    const [contactsLastMonth] = await db
      .select({ count: count() })
      .from(contacts)
      .where(sql`${contacts.createdAt} >= ${startOfLastMonth} AND ${contacts.createdAt} < ${startOfMonth} AND ${contacts.businessId} = ${businessId}`);

    const [messagesThisWeek] = await db
      .select({ count: count() })
      .from(messages)
      .where(sql`${messages.sentAt} >= ${startOfWeek} AND ${messages.status} IN ('sent', 'delivered') AND ${messages.businessId} = ${businessId}`);
    const [messagesLastWeek] = await db
      .select({ count: count() })
      .from(messages)
      .where(sql`${messages.sentAt} >= ${startOfPrevWeek} AND ${messages.sentAt} < ${startOfWeek} AND ${messages.status} IN ('sent', 'delivered') AND ${messages.businessId} = ${businessId}`);

    const [deliveredThisWeek] = await db
      .select({ count: count() })
      .from(messages)
      .where(sql`${messages.sentAt} >= ${startOfWeek} AND ${messages.status} = 'delivered' AND ${messages.businessId} = ${businessId}`);
    const [sentThisWeek] = await db
      .select({ count: count() })
      .from(messages)
      .where(sql`${messages.sentAt} >= ${startOfWeek} AND ${messages.status} IN ('sent', 'delivered') AND ${messages.businessId} = ${businessId}`);
    const [deliveredLastWeek] = await db
      .select({ count: count() })
      .from(messages)
      .where(sql`${messages.sentAt} >= ${startOfPrevWeek} AND ${messages.sentAt} < ${startOfWeek} AND ${messages.status} = 'delivered' AND ${messages.businessId} = ${businessId}`);
    const [sentLastWeek] = await db
      .select({ count: count() })
      .from(messages)
      .where(sql`${messages.sentAt} >= ${startOfPrevWeek} AND ${messages.sentAt} < ${startOfWeek} AND ${messages.status} IN ('sent', 'delivered') AND ${messages.businessId} = ${businessId}`);

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
        campaignsChange === null ? null : Math.round(campaignsChange * 100) / 100,
      deliveryRateChange:
        deliveryRateChange === null
          ? null
          : Math.round(deliveryRateChange * 100) / 100,
    };
  }

  async getContactStats(status?: string): Promise<{
    allContacts: number;
    inactive: number;
    activeContacts: number;
  }> {
    const businessId = this.requireBusinessId();
    if (status === "active") {
      const [active] = await db
        .select({ count: count() })
        .from(contacts)
        .where(
          sql`${contacts.status} = 'active' AND ${contacts.businessId} = ${businessId}`,
        );
      return { allContacts: active.count, inactive: 0, activeContacts: active.count };
    }
    if (status === "inactive") {
      const [inactive] = await db
        .select({ count: count() })
        .from(contacts)
        .where(
          sql`${contacts.status} = 'inactive' AND ${contacts.businessId} = ${businessId}`,
        );
      return { allContacts: inactive.count, inactive: inactive.count, activeContacts: 0 };
    }

    const [allContacts] = await db
      .select({ count: count() })
      .from(contacts)
      .where(eq(contacts.businessId, businessId));
    const [inactiveContacts] = await db
      .select({ count: count() })
      .from(contacts)
      .where(
        sql`${contacts.status} = 'inactive' AND ${contacts.businessId} = ${businessId}`,
      );
    const [activeContacts] = await db
      .select({ count: count() })
      .from(contacts)
      .where(
        sql`${contacts.status} = 'active' AND ${contacts.businessId} = ${businessId}`,
      );

    return {
      allContacts: allContacts.count,
      inactive: inactiveContacts.count,
      activeContacts: activeContacts.count,
    };
  }

  async getCampaignStats(): Promise<{
    activeCampaigns: number;
    messagesThisMonth: number;
    avgClickRate: number;
  }> {
    const businessId = this.requireBusinessId();
    const [activeCampaigns] = await db
      .select({ count: count() })
      .from(campaigns)
      .where(
        sql`${campaigns.status} = 'in_progress' AND ${campaigns.businessId} = ${businessId}`,
      );

    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const [messagesThisMonth] = await db
      .select({ count: count() })
      .from(messages)
      .where(sql`${messages.createdAt} >= ${firstDayOfMonth} AND ${messages.businessId} = ${businessId}`);

    const campaignsList = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.businessId, businessId));
    const totalClickRate = campaignsList.reduce(
      (sum, campaign) => sum + (campaign.clickCount || 0),
      0,
    );
    const totalSent = campaignsList.reduce(
      (sum, campaign) => sum + (campaign.sentCount || 0),
      0,
    );
    const avgClickRate = totalSent > 0 ? (totalClickRate / totalSent) * 100 : 0;

    return {
      activeCampaigns: activeCampaigns.count,
      messagesThisMonth: messagesThisMonth.count,
      avgClickRate: Math.round(avgClickRate * 100) / 100,
    };
  }

  async getAnalytics(
    range: 'thisMonth' | 'lastMonth' | 'thisWeek' | 'lastWeek',
  ): Promise<Analytics[]> {
    const businessId = this.requireBusinessId();
    const now = new Date();
    let start: Date;
    let end = new Date();
    switch (range) {
      case 'thisMonth':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'lastMonth':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'thisWeek':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'lastWeek':
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
        sql`${analytics.businessId} = ${businessId} AND ${analytics.date} >= ${start} AND ${analytics.date} < ${end}`,
      )
      .orderBy(desc(analytics.date));
  }

  async createBusiness(business: InsertBusiness): Promise<Business> {
    const [row] = await db.insert(businesses).values(business).returning();
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
    profile: InsertBusinessProfile,
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
    creds: InsertTwilioCredential & { messagingServiceSid?: string },
  ): Promise<TwilioCredential> {
    const businessId = this.requireBusinessId();
    const existing = await this.getTwilioCredentials();
    if (existing) {
      const [row] = await db
        .update(twilioCredentials)
        .set({ ...creds, updatedAt: new Date() })
        .where(eq(twilioCredentials.businessId, businessId))
        .returning();
      return row;
    }
    const [row] = await db
      .insert(twilioCredentials)
      .values({ ...creds, businessId })
      .returning();
    return row;
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
    numbers: InsertBusinessPhoneNumber[],
  ): Promise<BusinessPhoneNumber[]> {
    const businessId = this.requireBusinessId();
    await db
      .delete(businessPhoneNumbers)
      .where(eq(businessPhoneNumbers.businessId, businessId));
    if (numbers.length === 0) return [];
    const rows = await db
      .insert(businessPhoneNumbers)
      .values(numbers.map(n => ({ ...n, businessId })))
      .returning();
    return rows;
  }

  // Users
  // These lookup helpers are allowed to bypass tenant scoping
  // so authentication can look up a user before the business
  // context has been established.
  async getUserByUsername(username: string): Promise<User | undefined> {
    const base = db.select().from(users);
    const q = this.businessId !== undefined
      ? base.where(
          sql`${users.username} = ${username} AND ${users.businessId} = ${this.businessId}`,
        )
      : base.where(eq(users.username, username));
    const [user] = await q;
    return user || undefined;
  }

  async getUserById(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
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
}

export const storage = new DatabaseStorage();

export async function findTwilioCredentialByAccountSid(
  accountSid: string,
): Promise<TwilioCredential | undefined> {
  const [row] = await db
    .select()
    .from(twilioCredentials)
    .where(eq(twilioCredentials.accountSid, accountSid));
  return row || undefined;
}

export async function findBusinessIdByPhoneNumber(
  phoneNumber: string,
): Promise<number | undefined> {
  const normalized = normalizePhoneNumber(phoneNumber);
  const [row] = await db
    .select({ businessId: businessPhoneNumbers.businessId })
    .from(businessPhoneNumbers)
    .where(eq(businessPhoneNumbers.phoneNumber, normalized));
  return row?.businessId;
}
