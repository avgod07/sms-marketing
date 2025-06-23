import { storage } from "./storage";
import { logInfo } from "../utils/logger.util";
import { db, pool } from "../config/db.config";
import { businesses } from "@shared/schema";
import { eq } from "drizzle-orm";

export async function seedData() {
  try {
    // Ensure a demo business and user exist for testing
    const demoBusinessName = "Seeded Business";
    const demoUsername = "demo";

    let [business] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.name, demoBusinessName));

    if (!business) {
      business = await storage.createBusiness({ name: demoBusinessName });
    }

    const biz = storage.forBusiness(business.id);

    const passwordHash = "";

    let existingUser = await storage.getUserByUsername(demoUsername);
    if (!existingUser) {
      existingUser = await biz.createUser({ username: demoUsername, passwordHash });
      logInfo(`Created demo user \"${demoUsername}\"`);
    } else {
      logInfo(`User "${demoUsername}" already exists. Skipping user creation.`);
    }

    logInfo(`Demo account created for username \"${demoUsername}\"`);

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
      },
      {
        firstName: "Sarah",
        lastName: "Johnson",
        phoneNumber: "+15551234568",
        email: "sarah@example.com",
      },
      {
        firstName: "Mike",
        lastName: "Smith",
        phoneNumber: "+15551234569",
        email: "mike@example.com",
      },
      {
        firstName: "Emily",
        lastName: "Davis",
        phoneNumber: "+15551234570",
        email: "emily@example.com",
      },
      {
        firstName: "David",
        lastName: "Wilson",
        phoneNumber: "+15551234571",
        email: "david@example.com",
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
        status: "completed",
      },
      {
        name: "Welcome Series",
        message: "Welcome to TextFlow! 👋 Thanks for joining us. Get 20% off your first order with code WELCOME20",
        status: "in_progress",
      },
      {
        name: "VIP Exclusive",
        message: "🌟 VIP EXCLUSIVE: Early access to our new collection! Shop before everyone else: bit.ly/vip-early",
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

    logInfo("Sample data seeded successfully!");

    // ----- Optional second business for multi-tenant testing -----
    const secondBusinessName = "Second Seeded Business";
    const secondUsername = "demo2";

    let [business2] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.name, secondBusinessName));

    if (!business2) {
      business2 = await storage.createBusiness({ name: secondBusinessName });
    }

    const biz2 = storage.forBusiness(business2.id);

    let secondUser = await storage.getUserByUsername(secondUsername);
    if (!secondUser) {
      secondUser = await biz2.createUser({ username: secondUsername, passwordHash });
      logInfo(`Created demo user \"${secondUsername}\"`);
    } else {
      logInfo(`User "${secondUsername}" already exists. Skipping user creation.`);
    }

    const existingSecondContacts = await biz2.getContacts();
    if (existingSecondContacts.length === 0) {
      await biz2.createContact({
        firstName: "Jane",
        lastName: "Doe",
        phoneNumber: "+15550000000",
        email: "jane@example.com",
      });
    }
  } catch (error) {
    console.error("Error seeding data:", error);
  }
}

// Execute when run directly
(async () => {
  await seedData();
  await pool.end();
})();
