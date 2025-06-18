import { nanoid } from 'nanoid';

export interface MagicTokenInfo {
  userId: number;
  businessId: number;
  expiresAt: number;
}

const tokens = new Map<string, MagicTokenInfo>();

export function createMagicToken(userId: number, businessId: number) {
  const token = nanoid();
  tokens.set(token, {
    userId,
    businessId,
    expiresAt: Date.now() + 1000 * 60 * 15, // 15 minutes
  });
  return token;
}

export function verifyMagicToken(token: string): MagicTokenInfo | null {
  const info = tokens.get(token);
  if (!info) return null;
  if (Date.now() > info.expiresAt) {
    tokens.delete(token);
    return null;
  }
  tokens.delete(token);
  return info;
}
