import { describe, it, expect } from 'vitest';

import { buildVerificationDeepLink } from '../email-utils.js';

describe('buildVerificationDeepLink', () => {
  it('should extract token from a BetterAuth verification URL and return a deep link', () => {
    const url = 'https://api.ceolx.ie/api/auth/verify-email?token=abc123xyz';
    expect(buildVerificationDeepLink(url)).toBe('ceolx://verify-email?token=abc123xyz');
  });

  it('should handle a long token with special characters', () => {
    const token = 'eyJhbGciOiJIUzI1NiJ9.somePayload.signature';
    const url = `https://api.ceolx.ie/api/auth/verify-email?token=${encodeURIComponent(token)}`;
    const result = buildVerificationDeepLink(url);
    expect(result).toContain('ceolx://verify-email?token=');
    // token is URL-decoded in the deep link
    expect(result).toBe(`ceolx://verify-email?token=${token}`);
  });

  it('should return empty token when URL has no token param', () => {
    const url = 'https://api.ceolx.ie/api/auth/verify-email';
    expect(buildVerificationDeepLink(url)).toBe('ceolx://verify-email?token=');
  });

  it('should ignore extra query params and only use the token', () => {
    const url = 'https://api.ceolx.ie/api/auth/verify-email?token=tok999&callbackURL=%2F';
    expect(buildVerificationDeepLink(url)).toBe('ceolx://verify-email?token=tok999');
  });
});
