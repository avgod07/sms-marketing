import {
  contacts,
  campaigns,
  messages,
  coupons,
  couponRedemptions,
  couponRecipients,
  analytics,
  users,
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
} from "@shared/schema";
import type { ContactRedemption } from "@shared/api-types";
import { db } from "./db";
import { eq, desc, count, sql } from "drizzle-orm";
import { normalizePhoneNumber } from "./phone";

export interface IStorage {
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
    contactsChange: number;
    messagesChange: number;
    campaignsChange: number;
    deliveryRateChange: number;
  }>;
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
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserById(id: number): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
}

export class DatabaseStorage implements IStorage {
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
    return await db.select().from(contacts).orderBy(desc(contacts.createdAt));
  }

  async getContactsBySegment(segment: string): Promise<Contact[]> {
    if (segment === "all") {
      return await this.getContacts();
    }
    if (segment === "inactive" || segment === "active") {
      return await db
        .select()
        .from(contacts)
        .where(eq(contacts.status, segment))
        .orderBy(desc(contacts.createdAt));
    }
    return await db
      .select()
      .from(contacts)
      .where(eq(contacts.segment, segment))
      .orderBy(desc(contacts.createdAt));
  }

  async getContactsByStatus(status: string): Promise<Contact[]> {
    if (status === "all") {
      return await this.getContacts();
    }
    return await db
      .select()
      .from(contacts)
      .where(eq(contacts.status, status))
      .orderBy(desc(contacts.createdAt));
  }

  async getContact(id: number): Promise<Contact | undefined> {
    const [contact] = await db
      .select()
      .from(contacts)
      .where(eq(contacts.id, id));
    return contact || undefined;
  }

  async createContact(contact: InsertContact): Promise<Contact> {
    const [newContact] = await db
      .insert(contacts)
      .values({
        ...contact,
        updatedAt: new Date(),
      })
      .returning();
    return newContact;
  }

  async updateContact(
    id: number,
    contact: Partial<InsertContact>,
  ): Promise<Contact> {
    const [updatedContact] = await db
      .update(contacts)
      .set({
        ...contact,
        updatedAt: new Date(),
      })
      .where(eq(contacts.id, id))
      .returning();
    return updatedContact;
  }

  async deleteContact(id: number): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.delete(messages).where(eq(messages.contactId, id));
      await tx
        .delete(couponRecipients)
        .where(eq(couponRecipients.contactId, id));
      await tx
        .update(couponRedemptions)
        .set({ contactId: null })
        .where(eq(couponRedemptions.contactId, id));
      await tx.delete(contacts).where(eq(contacts.id, id));
    });
  }

  async searchContacts(query: string, status?: string): Promise<Contact[]> {
    const searchSql = sql`${contacts.firstName} ILIKE ${"%" + query + "%"} OR ${contacts.lastName} ILIKE ${"%" + query + "%"} OR ${contacts.phoneNumber} ILIKE ${"%" + query + "%"} OR ${contacts.email} ILIKE ${"%" + query + "%"}`;
    const whereClause =
      status && status !== "all"
        ? sql`(${searchSql}) AND ${contacts.status} = ${status}`
        : searchSql;
    return await db
      .select()
      .from(contacts)
      .where(whereClause)
      .orderBy(desc(contacts.createdAt));
  }

  async getContactByPhoneNumber(
    phoneNumber: string,
  ): Promise<Contact | undefined> {
    const normalized = normalizePhoneNumber(phoneNumber);
    const [contact] = await db
      .select()
      .from(contacts)
      .where(eq(contacts.phoneNumber, normalized));
    return contact || undefined;
  }

  async hasContactReceivedCoupon(
    contactId: number,
    couponCode: string,
  ): Promise<boolean> {
    const [row] = await db
      .select({ id: couponRecipients.id })
      .from(couponRecipients)
      .innerJoin(
        coupons,
        eq(couponRecipients.couponId, coupons.id),
      )
      .where(
        sql`${couponRecipients.contactId} = ${contactId} AND ${coupons.code} = ${couponCode}`,
      )
      .limit(1);
    return !!row;
  }

  async hasContactRedeemedCoupon(
    contactId: number,
    couponId: number,
  ): Promise<boolean> {
    const [row] = await db
      .select({ id: couponRedemptions.id })
      .from(couponRedemptions)
      .where(
        sql`${couponRedemptions.contactId} = ${contactId} AND ${couponRedemptions.couponId} = ${couponId}`,
      )
      .limit(1);
    return !!row;
  }

  // Campaigns
  async getCampaigns(): Promise<Campaign[]> {
    return await db.select().from(campaigns).orderBy(desc(campaigns.createdAt));
  }

  async getCampaign(id: number): Promise<Campaign | undefined> {
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, id));
    return campaign || undefined;
  }

  async createCampaign(campaign: InsertCampaign): Promise<Campaign> {
    const [newCampaign] = await db
      .insert(campaigns)
      .values({
        ...campaign,
        updatedAt: new Date(),
      })
      .returning();
    return newCampaign;
  }

  async updateCampaign(
    id: number,
    campaign: Partial<Campaign>,
  ): Promise<Campaign> {
    const [updatedCampaign] = await db
      .update(campaigns)
      .set({
        ...campaign,
        updatedAt: new Date(),
      })
      .where(eq(campaigns.id, id))
      .returning();
    return updatedCampaign;
  }

  async deleteCampaign(id: number): Promise<void> {
    await db.delete(campaigns).where(eq(campaigns.id, id));
  }

  async normalizeCampaignStatuses(): Promise<void> {
    await db
      .update(campaigns)
      .set({ status: "in_progress", updatedAt: new Date() })
      .where(sql`${campaigns.status} IN ('active', 'paused')`);

    await db
      .update(campaigns)
      .set({ status: "completed", updatedAt: new Date() })
      .where(sql`${campaigns.status} IN ('sent', 'finished')`);
  }

  // Coupons
  async getCoupons(): Promise<Coupon[]> {
    const rows = await db.select().from(coupons).orderBy(desc(coupons.createdAt));
    return rows.map((c) => this.normalizeCouponStatus(c));
  }

  async getCoupon(id: number): Promise<Coupon | undefined> {
    const [coupon] = await db
      .select()
      .from(coupons)
      .where(eq(coupons.id, id));
    return coupon ? this.normalizeCouponStatus(coupon) : undefined;
  }

  async getCouponByCode(code: string): Promise<Coupon | undefined> {
    const [coupon] = await db
      .select()
      .from(coupons)
      .where(eq(coupons.code, code));
    return coupon || undefined;
  }

  async createCoupon(coupon: InsertCoupon): Promise<Coupon> {
    const [newCoupon] = await db
      .insert(coupons)
      .values({
        ...coupon,
        updatedAt: new Date(),
      })
      .returning();
    return this.normalizeCouponStatus(newCoupon);
  }

  async updateCoupon(
    id: number,
    coupon: Partial<Coupon>,
  ): Promise<Coupon> {
    const [updatedCoupon] = await db
      .update(coupons)
      .set({
        ...coupon,
        updatedAt: new Date(),
      })
      .where(eq(coupons.id, id))
      .returning();
    return this.normalizeCouponStatus(updatedCoupon);
  }

  async deleteCoupon(id: number): Promise<void> {
    await db.delete(coupons).where(eq(coupons.id, id));
  }

  async createCouponRedemption(
    redemption: InsertCouponRedemption,
  ): Promise<CouponRedemption> {
    const [newRedemption] = await db
      .insert(couponRedemptions)
      .values(redemption)
      .returning();
    return newRedemption;
  }

  async createCouponRecipient(
    recipient: InsertCouponRecipient,
  ): Promise<CouponRecipient> {
    const [record] = await db
      .insert(couponRecipients)
      .values(recipient)
      .returning();
    return record;
  }

  async getCouponRedemptions(couponId: number): Promise<CouponRedemption[]> {
    return await db
      .select()
      .from(couponRedemptions)
      .where(eq(couponRedemptions.couponId, couponId))
      .orderBy(desc(couponRedemptions.createdAt));
  }

  async getContactRedemptions(
    contactId: number,
  ): Promise<ContactRedemption[]> {
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
      .where(eq(couponRedemptions.contactId, contactId))
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

    const query = db.select().from(coupons);
    let rows = await (whereClause
      ? query.where(whereClause).orderBy(desc(coupons.createdAt))
      : query.orderBy(desc(coupons.createdAt)));
    rows = rows.map((c) => this.normalizeCouponStatus(c));
    if (filters.status && filters.status !== "all") {
      rows = rows.filter((c) => c.status === filters.status);
    }
    return rows;
  }

  // Messages
  async getMessages(): Promise<Message[]> {
    return await db.select().from(messages).orderBy(desc(messages.createdAt));
  }

  async getMessagesByCampaign(campaignId: number): Promise<Message[]> {
    return await db
      .select()
      .from(messages)
      .where(eq(messages.campaignId, campaignId))
      .orderBy(desc(messages.createdAt));
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const [newMessage] = await db.insert(messages).values(message).returning();
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
      .where(eq(messages.id, id))
      .returning();
    return updatedMessage;
  }

  // Analytics
  async getDashboardStats(): Promise<{
    totalContacts: number;
    messagesSent: number;
    activeCampaigns: number;
    deliveryRate: number;
    contactsChange: number;
    messagesChange: number;
    campaignsChange: number;
    deliveryRateChange: number;
  }> {
    const contactStats = await this.getContactStats();
    const contactsCount = { count: contactStats.allContacts };
    const [messagesCount] = await db
      .select({ count: count() })
      .from(messages)
      .where(eq(messages.status, "sent"));
    const [campaignsCount] = await db
      .select({ count: count() })
      .from(campaigns)
      .where(eq(campaigns.status, "in_progress"));

    const [deliveredCount] = await db
      .select({ count: count() })
      .from(messages)
      .where(eq(messages.status, "delivered"));
    const [totalSentCount] = await db
      .select({ count: count() })
      .from(messages)
      .where(sql`${messages.status} IN ('sent', 'delivered')`);

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
      .where(sql`${contacts.createdAt} >= ${startOfMonth}`);
    const [contactsLastMonth] = await db
      .select({ count: count() })
      .from(contacts)
      .where(
        sql`${contacts.createdAt} >= ${startOfLastMonth} AND ${contacts.createdAt} < ${startOfMonth}`,
      );

    const [messagesThisWeek] = await db
      .select({ count: count() })
      .from(messages)
      .where(
        sql`${messages.sentAt} >= ${startOfWeek} AND ${messages.status} IN ('sent', 'delivered')`,
      );
    const [messagesLastWeek] = await db
      .select({ count: count() })
      .from(messages)
      .where(
        sql`${messages.sentAt} >= ${startOfPrevWeek} AND ${messages.sentAt} < ${startOfWeek} AND ${messages.status} IN ('sent', 'delivered')`,
      );

    const [deliveredThisWeek] = await db
      .select({ count: count() })
      .from(messages)
      .where(
        sql`${messages.sentAt} >= ${startOfWeek} AND ${messages.status} = 'delivered'`,
      );
    const [sentThisWeek] = await db
      .select({ count: count() })
      .from(messages)
      .where(
        sql`${messages.sentAt} >= ${startOfWeek} AND ${messages.status} IN ('sent', 'delivered')`,
      );
    const [deliveredLastWeek] = await db
      .select({ count: count() })
      .from(messages)
      .where(
        sql`${messages.sentAt} >= ${startOfPrevWeek} AND ${messages.sentAt} < ${startOfWeek} AND ${messages.status} = 'delivered'`,
      );
    const [sentLastWeek] = await db
      .select({ count: count() })
      .from(messages)
      .where(
        sql`${messages.sentAt} >= ${startOfPrevWeek} AND ${messages.sentAt} < ${startOfWeek} AND ${messages.status} IN ('sent', 'delivered')`,
      );

    const [campaignsThisMonth] = await db
      .select({ count: count() })
      .from(campaigns)
      .where(
        sql`${campaigns.createdAt} >= ${startOfMonth} AND ${campaigns.status} = 'in_progress'`,
      );
    const [campaignsLastMonth] = await db
      .select({ count: count() })
      .from(campaigns)
      .where(
        sql`${campaigns.createdAt} >= ${startOfLastMonth} AND ${campaigns.createdAt} < ${startOfMonth} AND ${campaigns.status} = 'in_progress'`,
      );

    const contactsChange =
      contactsLastMonth.count > 0
        ? ((contactsThisMonth.count - contactsLastMonth.count) /
            contactsLastMonth.count) *
          100
        : 0;
    const messagesChange =
      messagesLastWeek.count > 0
        ? ((messagesThisWeek.count - messagesLastWeek.count) /
            messagesLastWeek.count) *
          100
        : 0;
    const campaignsChange =
      campaignsLastMonth.count > 0
        ? ((campaignsThisMonth.count - campaignsLastMonth.count) /
            campaignsLastMonth.count) *
          100
        : 0;

    const currentDeliveryRate =
      sentThisWeek.count > 0
        ? (deliveredThisWeek.count / sentThisWeek.count) * 100
        : 0;
    const lastDeliveryRate =
      sentLastWeek.count > 0
        ? (deliveredLastWeek.count / sentLastWeek.count) * 100
        : 0;
    const deliveryRateChange =
      lastDeliveryRate > 0 ? currentDeliveryRate - lastDeliveryRate : 0;

    return {
      totalContacts: contactsCount.count,
      messagesSent: messagesCount.count,
      activeCampaigns: campaignsCount.count,
      deliveryRate: Math.round(deliveryRate * 100) / 100,
      contactsChange: Math.round(contactsChange * 100) / 100,
      messagesChange: Math.round(messagesChange * 100) / 100,
      campaignsChange: Math.round(campaignsChange * 100) / 100,
      deliveryRateChange: Math.round(deliveryRateChange * 100) / 100,
    };
  }

  async getContactStats(status?: string): Promise<{
    allContacts: number;
    inactive: number;
    activeContacts: number;
  }> {
    if (status === "active") {
      const [active] = await db
        .select({ count: count() })
        .from(contacts)
        .where(eq(contacts.status, "active"));
      return { allContacts: active.count, inactive: 0, activeContacts: active.count };
    }
    if (status === "inactive") {
      const [inactive] = await db
        .select({ count: count() })
        .from(contacts)
        .where(eq(contacts.status, "inactive"));
      return { allContacts: inactive.count, inactive: inactive.count, activeContacts: 0 };
    }

    const [allContacts] = await db.select({ count: count() }).from(contacts);
    const [inactiveContacts] = await db
      .select({ count: count() })
      .from(contacts)
      .where(eq(contacts.status, "inactive"));
    const [activeContacts] = await db
      .select({ count: count() })
      .from(contacts)
      .where(eq(contacts.status, "active"));

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
    const [activeCampaigns] = await db
      .select({ count: count() })
      .from(campaigns)
      .where(eq(campaigns.status, "in_progress"));

    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const [messagesThisMonth] = await db
      .select({ count: count() })
      .from(messages)
      .where(sql`${messages.createdAt} >= ${firstDayOfMonth}`);

    const campaignsList = await db.select().from(campaigns);
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

  // Users
  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username));
    return user || undefined;
  }

  async getUserById(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }
}

export const storage = new DatabaseStorage();
