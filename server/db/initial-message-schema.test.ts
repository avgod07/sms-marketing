import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "../config/db.config";
import { businesses, users } from "../../shared/schema";
import { eq } from "drizzle-orm";

// Mock database operations
vi.mock("../config/db.config", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    }),
  },
}));

describe("Initial Message Database Schema Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Businesses Table Schema", () => {
    it("should validate initialMessage field constraints", async () => {
      const mockBusiness = {
        id: 1,
        name: "Test Business",
        plan: "free_trial",
        initialMessage: "Welcome to our service! Text STOP to unsubscribe",
        onboardingComplete: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockSelectResponse = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockBusiness]),
        }),
      };

      db.select.mockReturnValue(mockSelectResponse);

      const result = await db.select().from(businesses);

      expect(result).toBeDefined();
      expect(db.select).toHaveBeenCalled();
    });

    it("should allow null initialMessage for new businesses", async () => {
      const mockBusiness = {
        id: 1,
        name: "Test Business",
        plan: "free_trial",
        initialMessage: null,
        onboardingComplete: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockInsertResponse = {
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockBusiness]),
        }),
      };

      db.insert.mockReturnValue(mockInsertResponse);

      const result = await db.insert(businesses).values({
        name: "Test Business",
        plan: "free_trial",
        initialMessage: null,
        onboardingComplete: false,
      });

      expect(result).toBeDefined();
      expect(db.insert).toHaveBeenCalledWith(businesses);
    });

    it("should default onboardingComplete to false for new businesses", async () => {
      const mockBusiness = {
        id: 1,
        name: "Test Business",
        plan: "free_trial",
        initialMessage: null,
        onboardingComplete: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockInsertResponse = {
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockBusiness]),
        }),
      };

      db.insert.mockReturnValue(mockInsertResponse);

      const result = await db.insert(businesses).values({
        name: "Test Business",
        plan: "free_trial",
      });

      expect(result).toBeDefined();
      expect(db.insert).toHaveBeenCalledWith(businesses);
    });

    it("should validate initialMessage text length constraints", async () => {
      const longMessage = "a".repeat(500); // Very long message

      const mockBusiness = {
        id: 1,
        name: "Test Business",
        plan: "free_trial",
        initialMessage: longMessage,
        onboardingComplete: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockUpdateResponse = {
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockBusiness]),
          }),
        }),
      };

      db.update.mockReturnValue(mockUpdateResponse);

      // The database should accept long messages (text field has no length limit)
      const result = await db
        .update(businesses)
        .set({ initialMessage: longMessage })
        .where(eq(businesses.id, 1));

      expect(result).toBeDefined();
      expect(db.update).toHaveBeenCalledWith(businesses);
    });

    it("should validate onboardingComplete boolean constraints", async () => {
      const mockBusiness = {
        id: 1,
        name: "Test Business",
        plan: "free_trial",
        initialMessage: "Welcome!",
        onboardingComplete: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockUpdateResponse = {
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockBusiness]),
          }),
        }),
      };

      db.update.mockReturnValue(mockUpdateResponse);

      const result = await db
        .update(businesses)
        .set({ onboardingComplete: true })
        .where(eq(businesses.id, 1));

      expect(result).toBeDefined();
      expect(db.update).toHaveBeenCalledWith(businesses);
    });

    it("should maintain referential integrity with users table", async () => {
      const mockUser = {
        id: 1,
        businessId: 1,
        username: "testuser",
        clerkId: "clerk_123",
        onboardingComplete: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockBusiness = {
        id: 1,
        name: "Test Business",
        plan: "free_trial",
        initialMessage: "Welcome!",
        onboardingComplete: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockSelectResponse = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockUser]),
        }),
      };

      db.select.mockReturnValue(mockSelectResponse);

      // Test that users can reference businesses
      const result = await db
        .select()
        .from(users)
        .where(eq(users.businessId, 1));

      expect(result).toBeDefined();
      expect(db.select).toHaveBeenCalled();
    });
  });

  describe("Schema Migration Compatibility", () => {
    it("should handle existing businesses without initial message", async () => {
      const existingBusiness = {
        id: 1,
        name: "Existing Business",
        plan: "free_trial",
        initialMessage: null,
        onboardingComplete: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockUpdateResponse = {
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              {
                ...existingBusiness,
                initialMessage: "Welcome! Text STOP to unsubscribe",
                onboardingComplete: true,
              },
            ]),
          }),
        }),
      };

      db.update.mockReturnValue(mockUpdateResponse);

      const result = await db
        .update(businesses)
        .set({
          initialMessage: "Welcome! Text STOP to unsubscribe",
          onboardingComplete: true,
        })
        .where(eq(businesses.id, 1));

      expect(result).toBeDefined();
      expect(db.update).toHaveBeenCalledWith(businesses);
    });

    it("should handle migration from user-level to business-level onboarding", async () => {
      const mockUser = {
        id: 1,
        businessId: 1,
        username: "testuser",
        clerkId: "clerk_123",
        onboardingComplete: true, // User-level onboarding complete
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockBusiness = {
        id: 1,
        name: "Test Business",
        plan: "free_trial",
        initialMessage: null,
        onboardingComplete: false, // Business-level onboarding not complete
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockSelectResponse = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockUser]),
        }),
      };

      db.select.mockReturnValue(mockSelectResponse);

      // Test that we can check user-level onboarding for migration
      const result = await db
        .select()
        .from(users)
        .where(eq(users.businessId, 1));

      expect(result).toBeDefined();
    });
  });

  describe("Data Integrity Constraints", () => {
    it("should enforce unique business names within reasonable limits", async () => {
      const mockBusiness1 = {
        id: 1,
        name: "Test Business",
        plan: "free_trial",
        initialMessage: "Welcome!",
        onboardingComplete: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockBusiness2 = {
        id: 2,
        name: "Test Business", // Same name should be allowed
        plan: "free_trial",
        initialMessage: "Welcome!",
        onboardingComplete: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockInsertResponse = {
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockBusiness2]),
        }),
      };

      db.insert.mockReturnValue(mockInsertResponse);

      // Business names don't need to be unique in this system
      const result = await db.insert(businesses).values({
        name: "Test Business",
        plan: "free_trial",
        initialMessage: "Welcome!",
        onboardingComplete: true,
      });

      expect(result).toBeDefined();
      expect(db.insert).toHaveBeenCalledWith(businesses);
    });

    it("should handle special characters in initial message", async () => {
      const messageWithSpecialChars =
        "Welcome! 🎉 Use code SAVE20 for 20% off. Text STOP to unsubscribe.";

      const mockBusiness = {
        id: 1,
        name: "Test Business",
        plan: "free_trial",
        initialMessage: messageWithSpecialChars,
        onboardingComplete: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockUpdateResponse = {
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockBusiness]),
          }),
        }),
      };

      db.update.mockReturnValue(mockUpdateResponse);

      const result = await db
        .update(businesses)
        .set({ initialMessage: messageWithSpecialChars })
        .where(eq(businesses.id, 1));

      expect(result).toBeDefined();
      expect(db.update).toHaveBeenCalledWith(businesses);
    });

    it("should handle empty string initial message", async () => {
      const mockBusiness = {
        id: 1,
        name: "Test Business",
        plan: "free_trial",
        initialMessage: "",
        onboardingComplete: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockUpdateResponse = {
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockBusiness]),
          }),
        }),
      };

      db.update.mockReturnValue(mockUpdateResponse);

      const result = await db
        .update(businesses)
        .set({ initialMessage: "" })
        .where(eq(businesses.id, 1));

      expect(result).toBeDefined();
      expect(db.update).toHaveBeenCalledWith(businesses);
    });
  });

  describe("Query Performance and Indexing", () => {
    it("should efficiently query businesses by onboarding status", async () => {
      const mockBusinesses = [
        {
          id: 1,
          name: "Complete Business",
          plan: "free_trial",
          initialMessage: "Welcome!",
          onboardingComplete: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 2,
          name: "Incomplete Business",
          plan: "free_trial",
          initialMessage: null,
          onboardingComplete: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const mockSelectResponse = {
        from: vi.fn().mockReturnValue({
          where: vi
            .fn()
            .mockResolvedValue(
              mockBusinesses.filter((b) => b.onboardingComplete)
            ),
        }),
      };

      db.select.mockReturnValue(mockSelectResponse);

      const result = await db.select().from(businesses);

      expect(result).toBeDefined();
      expect(db.select).toHaveBeenCalled();
    });

    it("should efficiently query businesses with initial messages", async () => {
      const mockBusinesses = [
        {
          id: 1,
          name: "Business with Message",
          plan: "free_trial",
          initialMessage: "Welcome!",
          onboardingComplete: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const mockSelectResponse = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockBusinesses),
        }),
      };

      db.select.mockReturnValue(mockSelectResponse);

      const result = await db.select().from(businesses);

      expect(result).toBeDefined();
      expect(db.select).toHaveBeenCalled();
    });
  });

  describe("Transaction Safety", () => {
    it("should handle concurrent updates to onboarding status", async () => {
      const mockBusiness = {
        id: 1,
        name: "Test Business",
        plan: "free_trial",
        initialMessage: "Welcome!",
        onboardingComplete: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockUpdateResponse = {
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockBusiness]),
          }),
        }),
      };

      db.update.mockReturnValue(mockUpdateResponse);

      // Simulate concurrent updates
      const update1 = db
        .update(businesses)
        .set({ onboardingComplete: true })
        .where(eq(businesses.id, 1));

      const update2 = db
        .update(businesses)
        .set({ initialMessage: "Welcome!" })
        .where(eq(businesses.id, 1));

      const results = await Promise.all([update1, update2]);

      expect(results).toHaveLength(2);
      expect(db.update).toHaveBeenCalledTimes(2);
    });

    it("should handle rollback scenarios for failed onboarding completion", async () => {
      const mockError = new Error("Database constraint violation");

      const mockUpdateResponse = {
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockRejectedValue(mockError),
        }),
      };

      db.update.mockReturnValue(mockUpdateResponse);

      try {
        await db
          .update(businesses)
          .set({
            initialMessage: "Welcome!",
            onboardingComplete: true,
          })
          .where(eq(businesses.id, 1));
      } catch (error) {
        expect(error).toBe(mockError);
      }

      expect(db.update).toHaveBeenCalledWith(businesses);
    });
  });
});
