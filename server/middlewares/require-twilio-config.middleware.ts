import { Request, Response, NextFunction } from 'express';
import { storage } from '../db/storage';

export async function requireTwilioConfig(req: Request, res: Response, next: NextFunction) {
  try {
    const bizId = (req as any).user?.businessId;
    if (!bizId) {
      return res.status(403).json({ message: 'Please complete onboarding to enable messaging.' });
    }
    const numbers = await storage.forBusiness(bizId).getPhoneNumbers();
    const defaultNum = numbers.find(n => n.isDefault);
    if (!defaultNum?.phoneNumber || !defaultNum?.serviceSid) {
      return res.status(403).json({ message: 'Please complete onboarding to enable messaging.' });
    }
    next();
  } catch (error) {
    next(error);
  }
}
