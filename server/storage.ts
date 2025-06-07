import {
  contacts,
  campaigns,
  messages,
  analytics,
  users,
  type Contact,
  type InsertContact,
  type Campaign,
  type InsertCampaign,
  type Message,
  type InsertMessage,
  type Analytics,
  type User,
  type InsertUser,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, count, sql } from "drizzle-orm";

export interface IStorage {
  // Contacts
  getContacts(): Promise<Contact[]>;
  getContactsBySegment(segment: string): Promise<Contact[]>;
  getContact(id: number): Promise<Contact | undefined>;
  createContact(contact: InsertContact): Promise<Contact>;
  updateContact(id: number, contact: Partial<InsertContact>): Promise<Contact>;
  deleteContact(id: number): Promise<void>;
  searchContacts(query: string): Promise<Contact[]>;

  // Campaigns
  getCampaigns(): Promise<Campaign[]>;
  getCampaign(id: number): Promise<Campaign | undefined>;
  createCampaign(campaign: InsertCampaign): Promise<Campaign>;
  updateCampaign(id: number, campaign: Partial<Campaign>): Promise<Campaign>;
  deleteCampaign(id: number): Promise<void>;

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
  getContactStats(): Promise<{
    allContacts: number;
    vipCustomers: number;
    newLeads: number;
    inactive: number;
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
  // Contacts
  async getContacts(): Promise<Contact[]> {
    return await db.select().from(contacts).orderBy(desc(contacts.createdAt));
  }

  async getContactsBySegment(segment: string): Promise<Contact[]> {
    if (segment === "all") {
      return await this.getContacts();
    }
    return await db
      .select()
      .from(contacts)
      .where(eq(contacts.segment, segment))
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
    await db.delete(contacts).where(eq(contacts.id, id));
  }

  async searchContacts(query: string): Promise<Contact[]> {
    return await db
      .select()
      .from(contacts)
      .where(
        sql`${contacts.firstName} ILIKE ${"%" + query + "%"} OR ${contacts.lastName} ILIKE ${"%" + query + "%"} OR ${contacts.phoneNumber} ILIKE ${"%" + query + "%"} OR ${contacts.email} ILIKE ${"%" + query + "%"}`,
      )
      .orderBy(desc(contacts.createdAt));
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
    const [contactsCount] = await db.select({ count: count() }).from(contacts);
    const [messagesCount] = await db
      .select({ count: count() })
      .from(messages)
      .where(eq(messages.status, "sent"));
    const [campaignsCount] = await db
      .select({ count: count() })
      .from(campaigns)
      .where(eq(campaigns.status, "active"));

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
        sql`${campaigns.createdAt} >= ${startOfMonth} AND ${campaigns.status} = 'active'`,
      );
    const [campaignsLastMonth] = await db
      .select({ count: count() })
      .from(campaigns)
      .where(
        sql`${campaigns.createdAt} >= ${startOfLastMonth} AND ${campaigns.createdAt} < ${startOfMonth} AND ${campaigns.status} = 'active'`,
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

  async getContactStats(): Promise<{
    allContacts: number;
    vipCustomers: number;
    newLeads: number;
    inactive: number;
  }> {
    const [allContacts] = await db.select({ count: count() }).from(contacts);
    const [vipContacts] = await db
      .select({ count: count() })
      .from(contacts)
      .where(eq(contacts.segment, "vip"));
    const [newLeads] = await db
      .select({ count: count() })
      .from(contacts)
      .where(eq(contacts.segment, "new_leads"));
    const [inactiveContacts] = await db
      .select({ count: count() })
      .from(contacts)
      .where(eq(contacts.status, "inactive"));

    return {
      allContacts: allContacts.count,
      vipCustomers: vipContacts.count,
      newLeads: newLeads.count,
      inactive: inactiveContacts.count,
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
      .where(eq(campaigns.status, "active"));

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
