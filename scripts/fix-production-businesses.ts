import { db } from "../server/config/db.config.js";
import { businesses } from "../shared/schema.js";
import { eq, isNull } from "drizzle-orm";
import twilio from "twilio";

async function fixProductionBusinesses() {
  console.log(
    "🔄 Fixing production businesses without messaging service SIDs..."
  );

  // Check environment variables
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    console.error("❌ TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set");
    process.exit(1);
  }

  const client = twilio(accountSid, authToken);

  try {
    // Find businesses without messaging service SIDs
    const businessesWithoutSid = await db
      .select()
      .from(businesses)
      .where(isNull(businesses.messagingServiceSid));

    console.log(
      `📊 Found ${businessesWithoutSid.length} businesses without messaging service SIDs`
    );

    if (businessesWithoutSid.length === 0) {
      console.log("✅ All businesses already have messaging service SIDs!");
      return;
    }

    // Create messaging services for each business
    for (const business of businessesWithoutSid) {
      try {
        console.log(
          `🏢 Creating messaging service for business ${business.id} (${business.name})...`
        );

        const service = await client.messaging.services.create({
          friendlyName: `Business ${business.id} - ${business.name} - Messaging Service`,
        });

        // Update the business with the new messaging service SID
        await db
          .update(businesses)
          .set({ messagingServiceSid: service.sid })
          .where(eq(businesses.id, business.id));

        console.log(
          `✅ Created messaging service ${service.sid} for business ${business.id}`
        );

        // Small delay to avoid rate limits
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error(
          `❌ Failed to create messaging service for business ${business.id}:`,
          error
        );
      }
    }

    console.log("🎉 Production fix completed!");
  } catch (error) {
    console.error("❌ Production fix failed:", error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

fixProductionBusinesses();
