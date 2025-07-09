import { Request, Response, NextFunction } from 'express';
import { storage } from '../db/storage';

export async function validateCoupon(req: Request, res: Response, next: NextFunction) {
  try {
    const code = req.params.code;
    const bizId = (req as any).user.businessId;
    const coupon = await storage.forBusiness(bizId).getCouponByCode(code);
    if (!coupon) {
      return res.status(404).json({ message: 'Coupon not found' });
    }
    if (coupon.status !== 'active') {
      return res.status(400).json({ error: 'INACTIVE' });
    }
    if (coupon.expirationDate && new Date(coupon.expirationDate) < new Date()) {
      return res.status(400).json({ error: 'EXPIRED' });
    }
    if (
      coupon.validDays !== null &&
      coupon.validDays !== undefined &&
      new Date(coupon.createdAt).getTime() + coupon.validDays * 24 * 60 * 60 * 1000 < Date.now()
    ) {
      return res.status(400).json({ error: 'EXPIRED' });
    }

    (req as any).coupon = coupon;
    next();
  } catch (error) {
    next(error);
  }
}
