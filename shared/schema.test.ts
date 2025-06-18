import { describe, it, expect } from 'vitest';
import { contacts } from './schema';

describe('contacts schema', () => {
  it('enforces global uniqueness for phoneNumber', () => {
    expect((contacts as any).phoneNumber.isUnique).toBe(true);
  });
});

