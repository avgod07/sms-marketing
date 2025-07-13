import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import express from "express";

// Mock variables
let mockDb: any;
let mockStorage: any;
let mockForBusiness: any;
let mockSendSMS: any;
let mockBroadcast: any;
let registerRoutes: any;

// Mock database config
vi.mock("../config/db.config", () => {
  mockDb = {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 1 }]),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 1 }]),
        }),
      }),
    }),
  };
  return { db: mockDb };
});

// Mock Clerk authentication
vi.mock("@clerk/express", () => ({
  requireAuth: () => (req: any, res: any, next: any) => {
    const auth = typeof req.auth === "function" ? req.auth() : req.auth;
    if (auth?.userId) {
      return next();
    }
    return res.status(302).redirect("/sign-in");
  },
}));

// Mock storage
vi.mock("../db/storage", () => {
  mockForBusiness = {
    createUser: vi.fn(),
    getCredits: vi.fn().mockResolvedValue({ balance: 100 }),
    adjustCredits: vi.fn(),
    getContacts: vi.fn().mockResolvedValue([]),
    getCampaigns: vi.fn().mockResolvedValue([]),
    getCoupons: vi.fn().mockResolvedValue([]),
    getDashboardStats: vi.fn().mockResolvedValue({}),
    deleteCampaign: vi.fn().mockResolvedValue(undefined),
    getBusiness: vi.fn().mockResolvedValue({
      id: 1,
      name: "Test Business",
      onboardingComplete: false,
      initialMessage: null,
    }),
    getTwilioCredentials: vi.fn().mockResolvedValue({
      accountSid: "test_account_sid",
      messagingServiceSid: "test_messaging_service_sid",
    }),
    getPhoneNumbers: vi
      .fn()
      .mockResolvedValue([{ phoneNumber: "+1234567890", isDefault: true }]),
    createContact: vi.fn().mockResolvedValue({
      id: 1,
      firstName: "Test",
      lastName: "User",
      phoneNumber: "+1234567890",
      businessId: 1,
    }),
    createMessage: vi.fn().mockResolvedValue({
      id: 1,
      content: "Test message",
      status: "sent",
      messageSid: "SM123456789",
    }),
  };
  mockStorage = {
    getUserByUsername: vi.fn(),
    getUserByClerkId: vi.fn().mockResolvedValue({
      id: 1,
      businessId: 1,
      username: "testuser",
      onboardingComplete: false,
    }),
    createBusiness: vi.fn().mockResolvedValue({ id: 1 }),
    forBusiness: vi.fn(() => mockForBusiness),
  };
  return {
    storage: mockStorage,
    findBusinessIdByPhoneNumber: vi.fn(),
  };
});

// Mock Twilio service
vi.mock("../services/twilio", () => {
  mockSendSMS = vi.fn().mockResolvedValue({
    success: true,
    messageSid: "SM123456789",
  });
  return { TwilioService: { sendSMS: mockSendSMS } };
});

// Mock Socket service
vi.mock("../socket", () => ({
  socketService: { broadcast: (mockBroadcast = vi.fn()) },
}));

// Mock encryption utils
vi.mock("../utils/encryption.util", () => ({
  decrypt: vi.fn(() => "token"),
  encrypt: vi.fn(),
}));

// Mock Stripe service
vi.mock("../services/stripe", () => ({
  createCheckoutSession: vi
    .fn()
    .mockResolvedValue({ url: "https://stripe.test/session" }),
  verifyWebhookSignature: vi.fn(),
}));

describe("Initial Message End-to-End Integration Tests", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Set up default mock responses
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi
          .fn()
          .mockResolvedValue([
            { id: 1, businessId: 1, onboardingComplete: false },
          ]),
      }),
    });

    mockForBusiness.getBusiness.mockResolvedValue({
      id: 1,
      name: "Test Business",
      onboardingComplete: false,
      initialMessage: null,
    });

    app = await setupApp({ userId: "clerk_user_123" });
  });

  describe("Complete Onboarding Flow", () => {
    it("should complete full onboarding flow with initial message", async () => {
      const initialMessage =
        "Welcome to our service! We're excited to have you.";
      const expectedCompleteMessage =
        initialMessage + " Text STOP to unsubscribe";

      // Mock user lookup
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi
            .fn()
            .mockResolvedValue([
              { id: 1, businessId: 1, onboardingComplete: false },
            ]),
        }),
      });

      // Mock business update
      mockDb.update.mockReturnValueOnce({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              {
                id: 1,
                initialMessage: expectedCompleteMessage,
                onboardingComplete: true,
              },
            ]),
          }),
        }),
      });

      // Step 1: Complete onboarding
      const onboardingResponse = await request(app)
        .post("/api/onboarding/complete")
        .send({ initialMessage });

      expect(onboardingResponse.status).toBe(200);
      expect(onboardingResponse.body.success).toBe(true);
      expect(onboardingResponse.body.message).toBe(
        "Onboarding completed successfully"
      );

      // Step 2: Verify setup status reflects completion
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi
            .fn()
            .mockResolvedValue([
              { id: 1, businessId: 1, onboardingComplete: true },
            ]),
        }),
      });

      const statusResponse = await request(app).get("/api/setup/status");

      expect(statusResponse.status).toBe(200);
      expect(statusResponse.body.onboardingComplete).toBe(true);
    });

    it("should handle onboarding with edge case messages", async () => {
      const testCases = [
        {
          name: "message with existing compliance text",
          message: "Welcome! Text STOP to unsubscribe",
          expected: "Welcome! Text STOP to unsubscribe",
        },
        {
          name: "message with special characters",
          message: "Welcome! 🎉 Use code SAVE20 for 20% off",
          expected:
            "Welcome! 🎉 Use code SAVE20 for 20% off Text STOP to unsubscribe",
        },
        {
          name: "maximum length message",
          message: "a".repeat(136), // 136 + 24 = 160 chars
          expected: "a".repeat(136) + " Text STOP to unsubscribe",
        },
      ];

      for (const testCase of testCases) {
        // Reset mocks for each test case
        mockDb.select.mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi
              .fn()
              .mockResolvedValue([
                { id: 1, businessId: 1, onboardingComplete: false },
              ]),
          }),
        });

        mockDb.update.mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([
                {
                  id: 1,
                  initialMessage: testCase.expected,
                  onboardingComplete: true,
                },
              ]),
            }),
          }),
        });

        const response = await request(app)
          .post("/api/onboarding/complete")
          .send({ initialMessage: testCase.message });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      }
    });
  });

  describe("Contact Creation with Initial Message Flow", () => {
    it("should create contact and send initial message after onboarding", async () => {
      const contactData = {
        firstName: "John",
        lastName: "Doe",
        phoneNumber: "+1234567890",
      };

      const initialMessage = "Welcome to our service! Text STOP to unsubscribe";

      // Mock onboarding complete business
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              id: 1,
              businessId: 1,
              onboardingComplete: true,
              initialMessage: initialMessage,
            },
          ]),
        }),
      });

      // Mock business lookup
      mockForBusiness.getBusiness.mockResolvedValue({
        id: 1,
        name: "Test Business",
        onboardingComplete: true,
        initialMessage: initialMessage,
      });

      // Mock contact creation
      mockDb.insert.mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              id: 1,
              ...contactData,
              businessId: 1,
            },
          ]),
        }),
      });

      const response = await request(app)
        .post("/api/contacts")
        .send(contactData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.contact.firstName).toBe(contactData.firstName);

      // Verify SMS was sent
      expect(mockSendSMS).toHaveBeenCalledWith(
        expect.objectContaining({
          accountSid: "test_account_sid",
          messagingServiceSid: "test_messaging_service_sid",
        }),
        expect.objectContaining({
          to: contactData.phoneNumber,
          message: initialMessage,
          from: "+1234567890",
          contactId: 1,
        })
      );

      // Verify message was recorded
      expect(mockForBusiness.createMessage).toHaveBeenCalledWith({
        phoneNumber: contactData.phoneNumber,
        contactId: 1,
        content: initialMessage,
        status: "sent",
        messageSid: "SM123456789",
      });
    });

    it("should block contact creation when onboarding is incomplete", async () => {
      const contactData = {
        firstName: "John",
        lastName: "Doe",
        phoneNumber: "+1234567890",
      };

      // Mock onboarding incomplete business
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              id: 1,
              businessId: 1,
              onboardingComplete: false,
              initialMessage: null,
            },
          ]),
        }),
      });

      mockForBusiness.getBusiness.mockResolvedValue({
        id: 1,
        name: "Test Business",
        onboardingComplete: false,
        initialMessage: null,
      });

      const response = await request(app)
        .post("/api/contacts")
        .send(contactData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("complete onboarding");
      expect(response.body.code).toBe("ONBOARDING_INCOMPLETE");

      // Verify contact was not created
      expect(mockDb.insert).not.toHaveBeenCalled();

      // Verify SMS was not sent
      expect(mockSendSMS).not.toHaveBeenCalled();
    });

    it("should handle SMS sending failure gracefully", async () => {
      const contactData = {
        firstName: "John",
        lastName: "Doe",
        phoneNumber: "+1234567890",
      };

      const initialMessage = "Welcome to our service! Text STOP to unsubscribe";

      // Mock onboarding complete business
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              id: 1,
              businessId: 1,
              onboardingComplete: true,
              initialMessage: initialMessage,
            },
          ]),
        }),
      });

      mockForBusiness.getBusiness.mockResolvedValue({
        id: 1,
        name: "Test Business",
        onboardingComplete: true,
        initialMessage: initialMessage,
      });

      // Mock contact creation
      mockDb.insert.mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              id: 1,
              ...contactData,
              businessId: 1,
            },
          ]),
        }),
      });

      // Mock SMS failure
      mockSendSMS.mockRejectedValueOnce(new Error("SMS sending failed"));

      const response = await request(app)
        .post("/api/contacts")
        .send(contactData);

      // Contact creation should still succeed
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.contact.firstName).toBe(contactData.firstName);

      // Verify SMS was attempted
      expect(mockSendSMS).toHaveBeenCalled();
    });
  });

  describe("Public Contact Creation Flow", () => {
    it("should create public contact and send initial message", async () => {
      const publicContactData = {
        firstName: "Jane",
        lastName: "Smith",
        phoneNumber: "+1234567891",
        businessId: 1,
      };

      const initialMessage = "Welcome to our service! Text STOP to unsubscribe";

      // Mock onboarding complete business
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              id: 1,
              onboardingComplete: true,
              initialMessage: initialMessage,
            },
          ]),
        }),
      });

      // Mock contact creation
      mockDb.insert.mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              id: 1,
              ...publicContactData,
            },
          ]),
        }),
      });

      const response = await request(app)
        .post("/public/contacts")
        .send(publicContactData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.contact.firstName).toBe(publicContactData.firstName);

      // Verify SMS was sent
      expect(mockSendSMS).toHaveBeenCalledWith(
        expect.objectContaining({
          accountSid: "test_account_sid",
          messagingServiceSid: "test_messaging_service_sid",
        }),
        expect.objectContaining({
          to: publicContactData.phoneNumber,
          message: initialMessage,
          contactId: 1,
        })
      );
    });

    it("should block public contact creation when onboarding incomplete", async () => {
      const publicContactData = {
        firstName: "Jane",
        lastName: "Smith",
        phoneNumber: "+1234567891",
        businessId: 1,
      };

      // Mock onboarding incomplete business
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              id: 1,
              onboardingComplete: false,
              initialMessage: null,
            },
          ]),
        }),
      });

      const response = await request(app)
        .post("/public/contacts")
        .send(publicContactData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("complete onboarding");

      // Verify contact was not created
      expect(mockDb.insert).not.toHaveBeenCalled();

      // Verify SMS was not sent
      expect(mockSendSMS).not.toHaveBeenCalled();
    });
  });

  describe("Business Settings Integration", () => {
    it("should allow reading current initial message", async () => {
      const initialMessage = "Welcome to our service! Text STOP to unsubscribe";

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              id: 1,
              initialMessage: initialMessage,
              onboardingComplete: true,
            },
          ]),
        }),
      });

      const response = await request(app).get("/api/business/initial-message");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.initialMessage).toBe(initialMessage);
    });

    it("should allow updating initial message", async () => {
      const newMessage = "Updated welcome message!";
      const expectedCompleteMessage = newMessage + " Text STOP to unsubscribe";

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 1, businessId: 1 }]),
        }),
      });

      mockDb.update.mockReturnValueOnce({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              {
                id: 1,
                initialMessage: expectedCompleteMessage,
              },
            ]),
          }),
        }),
      });

      const response = await request(app)
        .post("/api/business/initial-message")
        .send({ initialMessage: newMessage });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe(
        "Initial message updated successfully"
      );
      expect(response.body.initialMessage).toBe(expectedCompleteMessage);
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle concurrent onboarding completions", async () => {
      const initialMessage = "Welcome to our service!";

      // Mock user lookup
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi
            .fn()
            .mockResolvedValue([
              { id: 1, businessId: 1, onboardingComplete: false },
            ]),
        }),
      });

      // Mock business update
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              {
                id: 1,
                initialMessage: initialMessage + " Text STOP to unsubscribe",
                onboardingComplete: true,
              },
            ]),
          }),
        }),
      });

      // Simulate concurrent requests
      const requests = Array(5)
        .fill(null)
        .map(() =>
          request(app).post("/api/onboarding/complete").send({ initialMessage })
        );

      const responses = await Promise.all(requests);

      // All requests should succeed (idempotent)
      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });

    it("should handle database connection errors gracefully", async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi
            .fn()
            .mockRejectedValue(new Error("Database connection failed")),
        }),
      });

      const response = await request(app)
        .post("/api/onboarding/complete")
        .send({ initialMessage: "Test message" });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });

    it("should validate message length limits", async () => {
      const longMessage = "a".repeat(200); // Too long

      const response = await request(app)
        .post("/api/onboarding/complete")
        .send({ initialMessage: longMessage });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("160 characters");
    });

    it("should handle missing required fields", async () => {
      const response = await request(app)
        .post("/api/onboarding/complete")
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Initial message is required");
    });
  });

  describe("Integration with SMS Compliance", () => {
    it("should ensure all sent messages include compliance text", async () => {
      const testMessages = [
        "Welcome!",
        "Thank you for joining",
        "Your account is ready",
        "Special offer inside",
      ];

      for (const message of testMessages) {
        // Reset mocks
        vi.clearAllMocks();

        // Mock onboarding complete business
        mockDb.select.mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              {
                id: 1,
                businessId: 1,
                onboardingComplete: true,
                initialMessage: message + " Text STOP to unsubscribe",
              },
            ]),
          }),
        });

        mockForBusiness.getBusiness.mockResolvedValue({
          id: 1,
          name: "Test Business",
          onboardingComplete: true,
          initialMessage: message + " Text STOP to unsubscribe",
        });

        mockDb.insert.mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              {
                id: 1,
                firstName: "Test",
                lastName: "User",
                phoneNumber: "+1234567890",
                businessId: 1,
              },
            ]),
          }),
        });

        const response = await request(app).post("/api/contacts").send({
          firstName: "Test",
          lastName: "User",
          phoneNumber: "+1234567890",
        });

        expect(response.status).toBe(201);

        // Verify SMS was sent with compliance text
        expect(mockSendSMS).toHaveBeenCalledWith(
          expect.any(Object),
          expect.objectContaining({
            message: message + " Text STOP to unsubscribe",
          })
        );
      }
    });
  });
});

// Helper function to set up Express app with mocked authentication
async function setupApp(user?: any) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    // Mock Clerk authentication
    req.auth = () => ({
      userId: user ? user.userId : undefined,
    });
    next();
  });

  if (!registerRoutes) {
    registerRoutes = (await import("../routes")).registerRoutes;
  }
  await registerRoutes(app);
  return app;
}
