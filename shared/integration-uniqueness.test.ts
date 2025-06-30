import { beforeEach, describe, expect, it } from "vitest";
import { execSync } from "child_process";
import { db } from "../server/config/db.config";
import { businesses, contacts, users } from "./schema";

// Helper to insert a business and return its id
async function createBusiness(name: string) {
  const [biz] = await db
    .insert(businesses)
    .values({ name, plan: "trial" })
    .returning();
  return biz.id;
}

describe("Multi-tenancy uniqueness integration", () => {
  beforeEach(async () => {
    // Reset the schema before each test
    execSync("node server/db/reset-schema.cjs", { stdio: "inherit" });
    // Apply schema directly using drizzle-kit
    execSync("npx drizzle-kit push", { stdio: "inherit" });
  });

  it("allows same phone number for contacts in different businesses, but not in the same business", async () => {
    const biz1 = await createBusiness("Biz1");
    const biz2 = await createBusiness("Biz2");
    // Insert same phone for both businesses
    await db
      .insert(contacts)
      .values({
        businessId: biz1,
        firstName: "A",
        lastName: "B",
        phoneNumber: "123",
        active: true,
      });
    await db
      .insert(contacts)
      .values({
        businessId: biz2,
        firstName: "C",
        lastName: "D",
        phoneNumber: "123",
        active: true,
      });
    // Insert duplicate for same business should fail
    let error;
    try {
      await db
        .insert(contacts)
        .values({
          businessId: biz1,
          firstName: "E",
          lastName: "F",
          phoneNumber: "123",
          active: true,
        });
    } catch (e: any) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toMatch(/unique|constraint/i);
  });

  it("allows same username for users in different businesses, but not in the same business", async () => {
    const biz1 = await createBusiness("Biz1");
    const biz2 = await createBusiness("Biz2");
    await db
      .insert(users)
      .values({ businessId: biz1, username: "user1", passwordHash: "x" });
    await db
      .insert(users)
      .values({ businessId: biz2, username: "user1", passwordHash: "y" });
    let error;
    try {
      await db
        .insert(users)
        .values({ businessId: biz1, username: "user1", passwordHash: "z" });
    } catch (e: any) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toMatch(/unique|constraint/i);
  });

  it("enforces global uniqueness for clerkId", async () => {
    const biz1 = await createBusiness("Biz1");
    const biz2 = await createBusiness("Biz2");
    await db
      .insert(users)
      .values({
        businessId: biz1,
        username: "a",
        passwordHash: "x",
        clerkId: "clerk123",
      });
    let error;
    try {
      await db
        .insert(users)
        .values({
          businessId: biz2,
          username: "b",
          passwordHash: "y",
          clerkId: "clerk123",
        });
    } catch (e: any) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toMatch(/unique|constraint/i);
  });
});
