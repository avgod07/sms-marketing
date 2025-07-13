import request from "supertest";
import express from "express";
import {
  vi,
  describe,
  it,
  expect,
  afterEach,
  beforeAll,
  beforeEach,
} from "vitest";

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
    getCredits: vi.fn().mockResolvedValue(100),
    adjustCredits: vi.fn(),
    getContacts: vi.fn().mockResolvedValue([]),
    getCampaigns: vi.fn().mockResolvedValue([]),
    getCoupons: vi.fn().mockResolvedValue([]),
    getDashboardStats: vi.fn().mockResolvedValue({}),
    deleteCampaign: vi.fn().mockResolvedValue(undefined),
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
vi.mock("../services/twilio.js", () => {
  mockSendSMS = vi.fn().mockResolvedValue({
    success: true,
    sid: "SM123456789",
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

describe("Initial Message Functionality", () => {
  let app: express.Express;

  beforeAll(async () => {
    registerRoutes = (await import("./index")).registerRoutes;
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await setupApp({ userId: "clerk_user_123" });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/onboarding/complete", () => {
    it("should complete onboarding with valid initial message", async () => {
      const initialMessage =
        "Welcome to our service! We're excited to have you.";
      const expectedCompleteMessage =
        initialMessage + " Text STOP to unsubscribe";

      // Mock database responses
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi
            .fn()
            .mockResolvedValue([
              { id: 1, businessId: 1, onboardingComplete: false },
            ]),
        }),
      });

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

      const response = await request(app)
        .post("/api/onboarding/complete")
        .send({ initialMessage });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("Onboarding completed successfully");

      // Verify database was updated
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("should append compliance text if not already present", async () => {
      const initialMessage = "Welcome to our service!";
      const expectedCompleteMessage =
        initialMessage + " Text STOP to unsubscribe";

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi
            .fn()
            .mockResolvedValue([
              { id: 1, businessId: 1, onboardingComplete: false },
            ]),
        }),
      });

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

      const response = await request(app)
        .post("/api/onboarding/complete")
        .send({ initialMessage });

      expect(response.status).toBe(200);

      // Verify the set method was called with the compliance text appended
      const setCall = mockDb.update().set;
      expect(setCall).toHaveBeenCalledWith({
        initialMessage: expectedCompleteMessage,
        onboardingComplete: true,
      });
    });

    it("should not duplicate compliance text if already present", async () => {
      const initialMessage = "Welcome! Text STOP to unsubscribe";

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi
            .fn()
            .mockResolvedValue([
              { id: 1, businessId: 1, onboardingComplete: false },
            ]),
        }),
      });

      mockDb.update.mockReturnValueOnce({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              {
                id: 1,
                initialMessage: initialMessage,
                onboardingComplete: true,
              },
            ]),
          }),
        }),
      });

      const response = await request(app)
        .post("/api/onboarding/complete")
        .send({ initialMessage });

      expect(response.status).toBe(200);

      // Verify compliance text was not duplicated
      const setCall = mockDb.update().set;
      expect(setCall).toHaveBeenCalledWith({
        initialMessage: initialMessage,
        onboardingComplete: true,
      });
    });

    it("should reject message over 160 characters", async () => {
      const longMessage = "a".repeat(200);

      const response = await request(app)
        .post("/api/onboarding/complete")
        .send({ initialMessage: longMessage });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("160 characters");
    });

    it("should require initialMessage parameter", async () => {
      const response = await request(app)
        .post("/api/onboarding/complete")
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Initial message is required");
    });

    it("should handle user not found", async () => {
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const response = await request(app)
        .post("/api/onboarding/complete")
        .send({ initialMessage: "Welcome!" });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("User not found");
    });
  });

  describe("GET /api/business/initial-message", () => {
    it("should return current initial message", async () => {
      const businessData = {
        id: 1,
        initialMessage: "Welcome to our service! Text STOP to unsubscribe",
        onboardingComplete: true,
      };

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([businessData]),
        }),
      });

      const response = await request(app).get("/api/business/initial-message");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.initialMessage).toBe(businessData.initialMessage);
    });

    it("should handle business not found", async () => {
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const response = await request(app).get("/api/business/initial-message");

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Business not found");
    });
  });

  describe("POST /api/business/initial-message", () => {
    it("should update initial message successfully", async () => {
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

    it("should reject message over 160 characters", async () => {
      const longMessage = "a".repeat(200);

      const response = await request(app)
        .post("/api/business/initial-message")
        .send({ initialMessage: longMessage });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("160 characters");
    });

    it("should require initialMessage parameter", async () => {
      const response = await request(app)
        .post("/api/business/initial-message")
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Initial message is required");
    });
  });

  describe("POST /api/contacts - Onboarding Enforcement", () => {
    it("should create contact and send initial message when onboarding complete", async () => {
      const contactData = {
        firstName: "John",
        lastName: "Doe",
        phoneNumber: "+1234567890",
      };

      // Mock onboarding complete business
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              id: 1,
              businessId: 1,
              onboardingComplete: true,
              initialMessage: "Welcome! Text STOP to unsubscribe",
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
        contactData.phoneNumber,
        "Welcome! Text STOP to unsubscribe"
      );
    });

    it("should block contact creation when onboarding incomplete", async () => {
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

      const response = await request(app)
        .post("/api/contacts")
        .send(contactData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("complete onboarding");

      // Verify contact was not created
      expect(mockDb.insert).not.toHaveBeenCalled();

      // Verify SMS was not sent
      expect(mockSendSMS).not.toHaveBeenCalled();
    });

    it("should create contact even if SMS fails", async () => {
      const contactData = {
        firstName: "John",
        lastName: "Doe",
        phoneNumber: "+1234567890",
      };

      // Mock onboarding complete business
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              id: 1,
              businessId: 1,
              onboardingComplete: true,
              initialMessage: "Welcome! Text STOP to unsubscribe",
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

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.contact.firstName).toBe(contactData.firstName);

      // Verify SMS was attempted
      expect(mockSendSMS).toHaveBeenCalled();
    });
  });

  describe("POST /public/contacts - Public Contact Creation", () => {
    it("should create public contact and send initial message when onboarding complete", async () => {
      const publicContactData = {
        firstName: "Jane",
        lastName: "Smith",
        phoneNumber: "+1234567891",
        businessId: 1,
      };

      // Mock onboarding complete business
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              id: 1,
              onboardingComplete: true,
              initialMessage: "Welcome! Text STOP to unsubscribe",
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
        publicContactData.phoneNumber,
        "Welcome! Text STOP to unsubscribe"
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

  describe("GET /api/setup/status - Setup Status Check", () => {
    it("should return incomplete status when onboarding not complete", async () => {
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              id: 1,
              businessId: 1,
              onboardingComplete: false,
            },
          ]),
        }),
      });

      const response = await request(app).get("/api/setup/status");

      expect(response.status).toBe(200);
      expect(response.body.onboardingComplete).toBe(false);
    });

    it("should return complete status when onboarding complete", async () => {
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              id: 1,
              businessId: 1,
              onboardingComplete: true,
            },
          ]),
        }),
      });

      const response = await request(app).get("/api/setup/status");

      expect(response.status).toBe(200);
      expect(response.body.onboardingComplete).toBe(true);
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
    registerRoutes = (await import("./index")).registerRoutes;
  }
  await registerRoutes(app);
  return app;
}
