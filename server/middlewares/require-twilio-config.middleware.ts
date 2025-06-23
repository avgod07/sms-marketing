import { Request, Response, NextFunction } from 'express';
import { storage } from '../db/storage';

export async function requireTwilioConfig(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;
    const bizId = user?.businessId;
    if (!bizId || !user?.onboardingComplete) {
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
