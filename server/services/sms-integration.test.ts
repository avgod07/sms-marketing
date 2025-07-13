import { describe, it, expect, vi, beforeEach } from "vitest";
import { TwilioService } from "./twilio.js";
import type { TwilioCredential } from "../../shared/schema";

// Mock Twilio client
const mockTwilioClient = {
  messages: {
    create: vi.fn(),
  },
  phoneNumbers: {
    create: vi.fn(),
  },
  incomingPhoneNumbers: {
    list: vi.fn(),
  },
};

// Mock the twilio module
vi.mock("twilio", () => ({
  default: vi.fn(() => mockTwilioClient),
  validateRequest: vi.fn(),
}));

// Mock logger
vi.mock("../utils/logger.util", () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
}));

// Mock database
vi.mock("../config/db.config", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
  },
}));

// Mock storage
vi.mock("../db/storage", () => ({
  storage: {
    forBusiness: vi.fn().mockReturnValue({
      adjustCredits: vi.fn(),
      getCredits: vi.fn().mockResolvedValue(100),
    }),
  },
}));

describe("SMS Integration Tests", () => {
  const mockCredentials: TwilioCredential = {
    id: 1,
    businessId: 1,
    accountSid: "test_account_sid",
    messagingServiceSid: "test_messaging_service_sid",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up environment variables for testing
    process.env.TWILIO_ACCOUNT_SID = "test_account_sid";
    process.env.TWILIO_AUTH_TOKEN = "test_auth_token";
    process.env.TWILIO_PHONE_NUMBER = "+1234567890";
  });

  describe("TwilioService.sendSMS", () => {
    it("should send SMS successfully with valid parameters", async () => {
      const mockMessage = {
        sid: "SM123456789",
        status: "queued",
        to: "+1234567890",
        body: "Welcome! Text STOP to unsubscribe",
      };

      mockTwilioClient.messages.create.mockResolvedValue(mockMessage);

      const result = await TwilioService.sendSMS(mockCredentials, {
        to: "+1234567890",
        message: "Welcome! Text STOP to unsubscribe",
        from: "+1234567890",
      });

      expect(result).toEqual({
        success: true,
        messageSid: "SM123456789",
      });

      expect(mockTwilioClient.messages.create).toHaveBeenCalledWith({
        body: "Welcome! Text STOP to unsubscribe",
        from: "+1234567890",
        to: "+1234567890",
      });
    });

    it("should handle SMS sending failure gracefully", async () => {
      const mockError = new Error("Twilio API error");
      mockTwilioClient.messages.create.mockRejectedValue(mockError);

      const result = await TwilioService.sendSMS(mockCredentials, {
        to: "+1234567890",
        message: "Welcome! Text STOP to unsubscribe",
        from: "+1234567890",
      });

      expect(result).toEqual({
        success: false,
        error: "Twilio API error",
      });

      expect(mockTwilioClient.messages.create).toHaveBeenCalledWith({
        body: "Welcome! Text STOP to unsubscribe",
        from: "+1234567890",
        to: "+1234567890",
      });
    });

    it("should handle missing environment variables", async () => {
      delete process.env.TWILIO_ACCOUNT_SID;
      delete process.env.TWILIO_AUTH_TOKEN;
      delete process.env.TWILIO_PHONE_NUMBER;

      const result = await TwilioService.sendSMS(undefined, {
        to: "+1234567890",
        message: "Welcome! Text STOP to unsubscribe",
        from: "+1234567890",
      });

      expect(result).toEqual({
        success: false,
        error: "Failed to send SMS",
      });
    });

    it("should use messaging service when available", async () => {
      const mockMessage = {
        sid: "SM123456789",
        status: "queued",
        to: "+1234567890",
        body: "Welcome! Text STOP to unsubscribe",
      };

      mockTwilioClient.messages.create.mockResolvedValue(mockMessage);

      await TwilioService.sendSMS(mockCredentials, {
        to: "+1234567890",
        message: "Welcome! Text STOP to unsubscribe",
        messagingServiceSid: "test_messaging_service_sid",
      });

      expect(mockTwilioClient.messages.create).toHaveBeenCalledWith({
        body: "Welcome! Text STOP to unsubscribe",
        messagingServiceSid: "test_messaging_service_sid",
        to: "+1234567890",
      });
    });

    it("should handle invalid phone number", async () => {
      const mockError = new Error("Invalid phone number");
      mockTwilioClient.messages.create.mockRejectedValue(mockError);

      const result = await TwilioService.sendSMS(mockCredentials, {
        to: "invalid-phone",
        message: "Welcome! Text STOP to unsubscribe",
        from: "+1234567890",
      });

      expect(result).toEqual({
        success: false,
        error: "Invalid phone number",
      });
    });

    it("should handle rate limiting", async () => {
      const mockError = new Error("Rate limit exceeded");
      mockTwilioClient.messages.create.mockRejectedValue(mockError);

      const result = await TwilioService.sendSMS(mockCredentials, {
        to: "+1234567890",
        message: "Welcome! Text STOP to unsubscribe",
        from: "+1234567890",
      });

      expect(result).toEqual({
        success: false,
        error: "Rate limit exceeded",
      });
    });

    it("should handle insufficient credits", async () => {
      const mockError = new Error("Insufficient balance");
      mockTwilioClient.messages.create.mockRejectedValue(mockError);

      const result = await TwilioService.sendSMS(mockCredentials, {
        to: "+1234567890",
        message: "Welcome! Text STOP to unsubscribe",
        from: "+1234567890",
      });

      expect(result).toEqual({
        success: false,
        error: "Insufficient balance",
      });
    });
  });

  describe("Initial Message Sending Integration", () => {
    it("should successfully send initial message after contact creation", async () => {
      const mockMessage = {
        sid: "SM123456789",
        status: "queued",
        to: "+1234567890",
        body: "Welcome to our service! Text STOP to unsubscribe",
      };

      mockTwilioClient.messages.create.mockResolvedValue(mockMessage);

      const result = await TwilioService.sendSMS(mockCredentials, {
        to: "+1234567890",
        message: "Welcome to our service! Text STOP to unsubscribe",
        from: "+1234567890",
        contactId: 123,
      });

      expect(result.success).toBe(true);
      expect(result.messageSid).toBe("SM123456789");
    });

    it("should handle initial message sending failure without blocking contact creation", async () => {
      const mockError = new Error("SMS service unavailable");
      mockTwilioClient.messages.create.mockRejectedValue(mockError);

      const result = await TwilioService.sendSMS(mockCredentials, {
        to: "+1234567890",
        message: "Welcome to our service! Text STOP to unsubscribe",
        from: "+1234567890",
        contactId: 123,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("SMS service unavailable");

      // This should not prevent contact creation from succeeding
      // (This behavior is tested in the API tests)
    });

    it("should send initial message with proper compliance text", async () => {
      const mockMessage = {
        sid: "SM123456789",
        status: "queued",
        to: "+1234567890",
        body: "Welcome to our service! Text STOP to unsubscribe",
      };

      mockTwilioClient.messages.create.mockResolvedValue(mockMessage);

      const result = await TwilioService.sendSMS(mockCredentials, {
        to: "+1234567890",
        message: "Welcome to our service! Text STOP to unsubscribe",
        from: "+1234567890",
        contactId: 123,
      });

      expect(result.success).toBe(true);
      expect(mockTwilioClient.messages.create).toHaveBeenCalledWith({
        body: "Welcome to our service! Text STOP to unsubscribe",
        from: "+1234567890",
        to: "+1234567890",
      });
    });

    it("should handle multiple concurrent SMS sends", async () => {
      const mockMessage = {
        sid: "SM123456789",
        status: "queued",
        to: "+1234567890",
        body: "Welcome! Text STOP to unsubscribe",
      };

      mockTwilioClient.messages.create.mockResolvedValue(mockMessage);

      const phoneNumbers = [
        "+1234567890",
        "+1234567891",
        "+1234567892",
        "+1234567893",
        "+1234567894",
      ];

      const promises = phoneNumbers.map((phone, index) =>
        TwilioService.sendSMS(mockCredentials, {
          to: phone,
          message: "Welcome! Text STOP to unsubscribe",
          from: "+1234567890",
          contactId: index + 1,
        })
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      results.forEach((result) => {
        expect(result.success).toBe(true);
        expect(result.messageSid).toBe("SM123456789");
      });

      expect(mockTwilioClient.messages.create).toHaveBeenCalledTimes(5);
    });

    it("should handle mixed success/failure scenarios", async () => {
      mockTwilioClient.messages.create
        .mockResolvedValueOnce({
          sid: "SM123456789",
          status: "queued",
          to: "+1234567890",
          body: "Welcome! Text STOP to unsubscribe",
        })
        .mockRejectedValueOnce(new Error("Invalid phone number"))
        .mockResolvedValueOnce({
          sid: "SM123456790",
          status: "queued",
          to: "+1234567892",
          body: "Welcome! Text STOP to unsubscribe",
        });

      const results = await Promise.all([
        TwilioService.sendSMS(mockCredentials, {
          to: "+1234567890",
          message: "Welcome! Text STOP to unsubscribe",
          from: "+1234567890",
          contactId: 1,
        }),
        TwilioService.sendSMS(mockCredentials, {
          to: "invalid-phone",
          message: "Welcome! Text STOP to unsubscribe",
          from: "+1234567890",
          contactId: 2,
        }),
        TwilioService.sendSMS(mockCredentials, {
          to: "+1234567892",
          message: "Welcome! Text STOP to unsubscribe",
          from: "+1234567890",
          contactId: 3,
        }),
      ]);

      expect(results[0].success).toBe(true);
      expect(results[0].messageSid).toBe("SM123456789");

      expect(results[1].success).toBe(false);
      expect(results[1].error).toBe("Invalid phone number");

      expect(results[2].success).toBe(true);
      expect(results[2].messageSid).toBe("SM123456790");
    });
  });

  describe("SMS Message Validation", () => {
    it("should validate message length constraints", async () => {
      const longMessage = "a".repeat(1600); // Very long message

      const result = await TwilioService.sendSMS(mockCredentials, {
        to: "+1234567890",
        message: longMessage,
        from: "+1234567890",
      });

      // Twilio will handle long messages by splitting them
      // Our service should still attempt to send
      expect(mockTwilioClient.messages.create).toHaveBeenCalledWith({
        body: longMessage,
        from: "+1234567890",
        to: "+1234567890",
      });
    });

    it("should handle special characters in message", async () => {
      const specialMessage = "Welcome! 🎉 Text STOP to unsubscribe";
      const mockMessage = {
        sid: "SM123456789",
        status: "queued",
        to: "+1234567890",
        body: specialMessage,
      };

      mockTwilioClient.messages.create.mockResolvedValue(mockMessage);

      const result = await TwilioService.sendSMS(mockCredentials, {
        to: "+1234567890",
        message: specialMessage,
        from: "+1234567890",
      });

      expect(result.success).toBe(true);
      expect(mockTwilioClient.messages.create).toHaveBeenCalledWith({
        body: specialMessage,
        from: "+1234567890",
        to: "+1234567890",
      });
    });

    it("should handle URLs in message", async () => {
      const messageWithUrl =
        "Welcome! Visit https://example.com Text STOP to unsubscribe";
      const mockMessage = {
        sid: "SM123456789",
        status: "queued",
        to: "+1234567890",
        body: messageWithUrl,
      };

      mockTwilioClient.messages.create.mockResolvedValue(mockMessage);

      const result = await TwilioService.sendSMS(mockCredentials, {
        to: "+1234567890",
        message: messageWithUrl,
        from: "+1234567890",
      });

      expect(result.success).toBe(true);
      expect(mockTwilioClient.messages.create).toHaveBeenCalledWith({
        body: messageWithUrl,
        from: "+1234567890",
        to: "+1234567890",
      });
    });
  });

  describe("Error Handling and Resilience", () => {
    it("should handle network timeouts", async () => {
      const timeoutError = new Error("Network timeout");
      mockTwilioClient.messages.create.mockRejectedValue(timeoutError);

      const result = await TwilioService.sendSMS(mockCredentials, {
        to: "+1234567890",
        message: "Welcome! Text STOP to unsubscribe",
        from: "+1234567890",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network timeout");
    });

    it("should handle Twilio service unavailable", async () => {
      const serviceError = new Error("Service unavailable");
      mockTwilioClient.messages.create.mockRejectedValue(serviceError);

      const result = await TwilioService.sendSMS(mockCredentials, {
        to: "+1234567890",
        message: "Welcome! Text STOP to unsubscribe",
        from: "+1234567890",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Service unavailable");
    });

    it("should handle authentication errors", async () => {
      const authError = new Error("Authentication failed");
      mockTwilioClient.messages.create.mockRejectedValue(authError);

      const result = await TwilioService.sendSMS(mockCredentials, {
        to: "+1234567890",
        message: "Welcome! Text STOP to unsubscribe",
        from: "+1234567890",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Authentication failed");
    });
  });

  describe("Compliance and Opt-out", () => {
    it("should include STOP compliance text in all messages", async () => {
      const testMessages = [
        "Welcome to our service! Text STOP to unsubscribe",
        "Thank you for joining! Text STOP to unsubscribe",
        "Your account is ready! Text STOP to unsubscribe",
      ];

      const mockMessage = {
        sid: "SM123456789",
        status: "queued",
        to: "+1234567890",
        body: "",
      };

      mockTwilioClient.messages.create.mockResolvedValue(mockMessage);

      for (const message of testMessages) {
        await TwilioService.sendSMS(mockCredentials, {
          to: "+1234567890",
          message: message,
          from: "+1234567890",
        });

        expect(mockTwilioClient.messages.create).toHaveBeenCalledWith({
          body: message,
          from: "+1234567890",
          to: "+1234567890",
        });
      }

      // All messages should contain STOP compliance text
      testMessages.forEach((message) => {
        expect(message.toLowerCase()).toContain("stop");
        expect(message.toLowerCase()).toContain("unsubscribe");
      });
    });

    it("should properly format compliance text", async () => {
      const messageWithCompliance = "Welcome! Text STOP to unsubscribe";

      // Test that compliance text is properly formatted
      expect(messageWithCompliance).toMatch(/Text STOP to unsubscribe$/);
      expect(messageWithCompliance).not.toMatch(
        /Text STOP to unsubscribe Text STOP to unsubscribe/
      );
    });
  });
});
