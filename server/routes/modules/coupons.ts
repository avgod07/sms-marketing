import type { Express } from "express";
import { z } from "zod";
import { requireAuth } from "@clerk/express";
import { insertCouponSchema } from "@shared/schema";
import { normalizePhoneNumber } from "../../utils/normalize.util.js";
import { logError, logInfo } from "../../utils/logger.util";
import { nanoid } from "nanoid";
import { createRateLimiter } from "../../middlewares/rate-limit.middleware";
import { validateCoupon } from "../../middlewares/coupon.middleware";
import { getBizForRequest, logDetailedError } from "./utils";

export function registerCouponRoutes(app: Express) {
  const redeemRateLimiter = createRateLimiter({ windowMs: 60_000, max: 10 });

  app.get("/api/coupons", requireAuth(), async (req, res) => {
    try {
      const { biz } = await getBizForRequest(req);
      const { search, status, type, startDate, endDate } = req.query as {
        search?: string;
        status?: string;
        type?: string;
        startDate?: string;
        endDate?: string;
      };

      const coupons = await biz.searchCoupons({
        search,
        status,
        type,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
      });
      res.json(coupons);
    } catch (error) {
      logError("Error fetching coupons:", error);
      res.status(500).json({ message: "Failed to fetch coupons" });
    }
  });

  app.get("/api/coupons/:id", requireAuth(), async (req, res) => {
    try {
      const { biz } = await getBizForRequest(req);
      const id = parseInt(req.params.id);
      const coupon = await biz.getCoupon(id);
      if (!coupon) {
        return res.status(404).json({ message: "Coupon not found" });
      }
      res.json(coupon);
    } catch (error) {
      logError("Error fetching coupon:", error);
      res.status(500).json({ message: "Failed to fetch coupon" });
    }
  });

  app.get("/api/coupons/:id/redemptions", requireAuth(), async (req, res) => {
    try {
      const { biz } = await getBizForRequest(req);
      const id = parseInt(req.params.id);
      const coupon = await biz.getCoupon(id);
      if (!coupon) {
        return res.status(404).json({ message: "Coupon not found" });
      }
      const redemptions = await biz.getCouponRedemptions(id);
      res.json(redemptions);
    } catch (error) {
      logError("Error fetching coupon redemptions:", error);
      res.status(500).json({ message: "Failed to fetch coupon redemptions" });
    }
  });

  app.post("/api/coupons", requireAuth(), async (req, res) => {
    try {
      const { biz } = await getBizForRequest(req);
      const data = { ...req.body } as any;
      if (!data.code) {
        data.code = nanoid(8).toUpperCase();
      }
      if (data.expirationDate) {
        data.expirationDate = new Date(data.expirationDate);
      }
      if (data.validDays !== undefined && data.validDays !== null) {
        data.validDays = Number(data.validDays);
      }
      const validatedData = insertCouponSchema.parse(data);
      const coupon = await biz.createCoupon(validatedData);
      res.status(201).json(coupon);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: "Validation error", errors: error.errors });
      }
      if (error.code === "23505") {
        return res.status(400).json({ message: "Coupon code already exists" });
      }
      logError("Error creating coupon:", error);
      res.status(500).json({ message: "Failed to create coupon" });
    }
  });

  app.patch("/api/coupons/:id", requireAuth(), async (req, res) => {
    try {
      const { biz } = await getBizForRequest(req);
      const id = parseInt(req.params.id);
      const data = { ...req.body } as any;
      if (data.expirationDate) {
        data.expirationDate = new Date(data.expirationDate);
      }
      if (data.validDays !== undefined && data.validDays !== null) {
        data.validDays = Number(data.validDays);
      }
      const validatedData = insertCouponSchema.partial().parse(data);
      const coupon = await biz.updateCoupon(id, validatedData);
      res.json(coupon);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: "Validation error", errors: error.errors });
      }
      logError("Error updating coupon:", error);
      res.status(500).json({ message: "Failed to update coupon" });
    }
  });

  app.post(
    "/api/coupons/:code/redeem",
    requireAuth(),
    redeemRateLimiter,
    validateCoupon,
    async (req, res) => {
      try {
        const { biz } = await getBizForRequest(req);
        const coupon = (req as any).coupon;
        const code = req.params.code;

        const rawPhone = req.body.phoneNumber;
        if (!rawPhone) {
          return res.status(400).json({ message: "phoneNumber is required" });
        }

        const phoneNumber = normalizePhoneNumber(rawPhone);

        const contact = await biz.getContactByPhoneNumber(phoneNumber);
        if (!contact) {
          return res.status(404).json({ message: "Contact not found" });
        }

        const received = await biz.hasContactReceivedCoupon(contact.id, code);
        if (!received) {
          return res.status(400).json({
            message:
              "This contact was not part of the campaign that received this coupon.",
          });
        }

        const alreadyRedeemed = await biz.hasContactRedeemedCoupon(
          contact.id,
          coupon.id
        );
        if (alreadyRedeemed) {
          return res.status(400).json({
            error: "ALREADY_REDEEMED",
            message: "This contact has already redeemed this coupon.",
          });
        }
        const contactId = contact.id;

        const currentCount = coupon.usageCount ?? 0;
        const updated = await biz.updateCoupon(coupon.id, {
          usageCount: currentCount + 1,
        });
        await biz.createCouponRedemption({
          couponId: coupon.id,
          contactId,
          phoneNumber,
          note: req.body.note,
        });
        logInfo("Coupon redeemed", {
          couponId: coupon.id,
          userId: (req as any).user?.id,
          contactId,
          phoneNumber,
        });
        res.json({ usageCount: updated.usageCount });
      } catch (error) {
        logError("Error redeeming coupon:", error);
        res.status(500).json({ message: "Failed to redeem coupon" });
      }
    }
  );

  app.delete("/api/coupons/:id", requireAuth(), async (req, res) => {
    try {
      const { biz } = await getBizForRequest(req);
      const id = parseInt(req.params.id);
      await biz.deleteCoupon(id);
      res.status(204).send();
    } catch (error) {
      logError("Error deleting coupon:", error);
      res.status(500).json({ message: "Failed to delete coupon" });
    }
  });
}
