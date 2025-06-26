import { describe, it, expect, vi, beforeEach } from "vitest";

beforeEach(() => {
  process.env.STRIPE_SECRET_KEY = "sk_test";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
});

vi.mock("stripe", () => {
  class MockStripe {
    checkout = {
      sessions: {
        create: vi
          .fn()
          .mockResolvedValue({ url: "https://stripe.test/session" }),
      },
    };
    webhooks = {
      constructEvent: vi.fn((payload, signature, secret) => {
        if (signature === "valid" && secret === "whsec_test") {
          return {
            type: "checkout.session.completed",
            data: {
              object: {
                id: "sess_123",
                metadata: { businessId: "1", credits: "10" },
              },
            },
          };
        }
        if (signature === "valid_payment_intent" && secret === "whsec_test") {
          return {
            type: "payment_intent.succeeded",
            data: {
              object: {
                id: "pi_123",
                metadata: { businessId: "2", credits: "25" },
              },
            },
          };
        }
        if (signature === "valid_refund" && secret === "whsec_test") {
          return {
            type: "charge.refunded",
            data: {
              object: {
                id: "ch_123",
                metadata: { businessId: "3", credits: "5" },
              },
            },
          };
        }
        throw new Error("Invalid signature");
      }),
    };
  }
  return { default: MockStripe };
});

import * as stripeService from "./stripe";

describe("stripeService", () => {
  it("creates a checkout session", async () => {
    const session = await stripeService.createCheckoutSession({
      businessId: 1,
      amount: 10,
      successUrl: "https://success",
      cancelUrl: "https://cancel",
    });
    expect(session.url).toBe("https://stripe.test/session");
  });

  it("verifies a valid webhook signature for checkout.session.completed", () => {
    const event = stripeService.verifyWebhookSignature(
      "valid",
      Buffer.from("{}")
    );
    expect(event).not.toBeNull();
    if (event) {
      expect(event.type).toBe("checkout.session.completed");
      const session = event.data.object as any;
      expect(session.id).toBe("sess_123");
      expect(session.metadata.businessId).toBe("1");
      expect(session.metadata.credits).toBe("10");
    }
  });

  it("verifies a valid webhook signature for payment_intent.succeeded", () => {
    const event = stripeService.verifyWebhookSignature(
      "valid_payment_intent",
      Buffer.from("{}")
    );
    expect(event).not.toBeNull();
    if (event) {
      expect(event.type).toBe("payment_intent.succeeded");
      const paymentIntent = event.data.object as any;
      expect(paymentIntent.id).toBe("pi_123");
      expect(paymentIntent.metadata.businessId).toBe("2");
      expect(paymentIntent.metadata.credits).toBe("25");
    }
  });

  it("verifies a valid webhook signature for charge.refunded", () => {
    const event = stripeService.verifyWebhookSignature(
      "valid_refund",
      Buffer.from("{}")
    );
    expect(event).not.toBeNull();
    if (event) {
      expect(event.type).toBe("charge.refunded");
      const charge = event.data.object as any;
      expect(charge.id).toBe("ch_123");
      expect(charge.metadata.businessId).toBe("3");
      expect(charge.metadata.credits).toBe("5");
    }
  });

  it("returns null for invalid webhook signature", () => {
    const event = stripeService.verifyWebhookSignature(
      "invalid",
      Buffer.from("{}")
    );
    expect(event).toBeNull();
  });
});
