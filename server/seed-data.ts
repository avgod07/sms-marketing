import { storage } from "./storage.js";
import { logInfo } from "./logger.js";

export async function seedData() {
  try {
    // Check if we already have data
    const existingContacts = await storage.getContacts();
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
        segment: "vip",
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
        segment: "new_leads",
        status: "active",
      },
      {
        firstName: "Emily",
        lastName: "Davis",
        phoneNumber: "+15551234570",
        email: "emily@example.com",
        segment: "inactive",
        status: "inactive",
      },
      {
        firstName: "David",
        lastName: "Wilson",
        phoneNumber: "+15551234571",
        email: "david@example.com",
        segment: "vip",
        status: "active",
      },
    ];

    for (const contact of sampleContacts) {
      await storage.createContact(contact);
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
        audience: "new_leads",
        status: "active",
      },
      {
        name: "VIP Exclusive",
        message: "🌟 VIP EXCLUSIVE: Early access to our new collection! Shop before everyone else: bit.ly/vip-early",
        audience: "vip",
        status: "active",
      },
    ];

    for (const campaign of sampleCampaigns) {
      await storage.createCampaign(campaign);
    }

    logInfo("Sample data seeded successfully!");
  } catch (error) {
    console.error("Error seeding data:", error);
  }
}