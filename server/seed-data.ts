import { storage } from "./storage";
import { logInfo } from "./logger";
import { db, pool } from "./db";
import { businesses } from "@shared/schema";
import { eq } from "drizzle-orm";
import { encrypt } from "./utils/encryption";
import bcrypt from "bcryptjs";

export async function seedData() {
  try {
    // Ensure a demo business and user exist for testing
    const demoBusinessName = "Demo Business";
    const demoUsername = "demo";
    const demoPassword = "demo";

    let [business] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.name, demoBusinessName));

    if (!business) {
      business = await storage.createBusiness({ name: demoBusinessName });
    }

    const biz = storage.forBusiness(business.id);

    let existingUser = await biz.getUserByUsername(demoUsername);
    if (!existingUser) {
      const passwordHash = await bcrypt.hash(demoPassword, 10);
      existingUser = await biz.createUser({ username: demoUsername, passwordHash });
      logInfo(`Created demo user \"${demoUsername}\"`);
    }

    logInfo(
      `Demo credentials: username \"${demoUsername}\" / password \"${demoPassword}\"`,
    );

    // Check if we already have contact data
    const existingContacts = await biz.getContacts();
    if (existingContacts.length > 0) {
      logInfo("Sample data already exists, skipping seed");
      return;
    }

    logInfo("Seeding sample data...");

    // Add sample contacts
    const sampleContacts = [
      {
        firstName: "John",
        lastName: "Doe",
        phoneNumber: "+15551234567",
        email: "john@example.com",
        segment: "all",
        status: "active",
      },
      {
        firstName: "Sarah",
        lastName: "Johnson",
        phoneNumber: "+15551234568",
        email: "sarah@example.com",
        segment: "all",
        status: "active",
      },
      {
        firstName: "Mike",
        lastName: "Smith",
        phoneNumber: "+15551234569",
        email: "mike@example.com",
        segment: "all",
        status: "active",
      },
      {
        firstName: "Emily",
        lastName: "Davis",
        phoneNumber: "+15551234570",
        email: "emily@example.com",
        segment: "all",
        status: "inactive",
      },
      {
        firstName: "David",
        lastName: "Wilson",
        phoneNumber: "+15551234571",
        email: "david@example.com",
        segment: "all",
        status: "active",
      },
    ];

    for (const contact of sampleContacts) {
      await biz.createContact(contact);
    }

    // Add sample campaigns
    const sampleCampaigns = [
      {
        name: "Black Friday Sale",
        message: "🔥 BLACK FRIDAY: 50% OFF everything! Use code BF50. Limited time only. Shop now: bit.ly/shop50",
        audience: "all",
        status: "completed",
      },
      {
        name: "Welcome Series",
        message: "Welcome to TextFlow! 👋 Thanks for joining us. Get 20% off your first order with code WELCOME20",
        audience: "active",
        status: "in_progress",
      },
      {
        name: "VIP Exclusive",
        message: "🌟 VIP EXCLUSIVE: Early access to our new collection! Shop before everyone else: bit.ly/vip-early",
        audience: "active",
        status: "in_progress",
      },
    ];

    for (const campaign of sampleCampaigns) {
      await biz.createCampaign(campaign);
    }

    // Add sample coupons
    const sampleCoupons = [
      {
        code: "WELCOME10",
        label: "Welcome Discount",
        type: "percent",
        value: "10",
        status: "active",
        expirationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      {
        code: "SPRING20",
        label: "Spring Sale",
        type: "percent",
        value: "20",
        status: "expired",
        expirationDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
      {
        code: "VIP50",
        label: "VIP Promo",
        type: "amount",
        value: "50",
        status: "disabled",
      },
      {
        code: "DAY30",
        label: "30 Day Valid",
        type: "percent",
        value: "15",
        status: "active",
        validDays: 30,
      },
    ];

    for (const coupon of sampleCoupons) {
      await biz.createCoupon(coupon);
    }

    // Seed dummy Twilio credentials so onboarding shows connected state
    await biz.upsertTwilioCredentials({
      accountSid: "ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
      authTokenEncrypted: encrypt("auth_token"),
      messagingServiceSid: "MGXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    });

    logInfo("Sample data seeded successfully!");
  } catch (error) {
    console.error("Error seeding data:", error);
  }
}

// Execute when run directly
(async () => {
  await seedData();
  await pool.end();
})();
