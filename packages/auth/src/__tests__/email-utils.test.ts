import { describe, it, expect } from 'vitest';

import { buildDeepLinkBridgeUrl, buildVerificationBridgeUrl } from '../email-utils.js';

const BRIDGE_HOST = 'https://staging.example.com';

describe('buildDeepLinkBridgeUrl', () => {
  it('builds an HTTPS bridge URL for an arbitrary app path and raw token', () => {
    expect(buildDeepLinkBridgeUrl('reset-password', 'tok123', BRIDGE_HOST)).toBe(
      `${BRIDGE_HOST}/reset-password?token=tok123`
    );
  });

  it('URL-encodes tokens containing special characters', () => {
    const token = 'eyJhbGciOiJIUzI1NiJ9.somePayload.signature';
    expect(buildDeepLinkBridgeUrl('reset-password', token, BRIDGE_HOST)).toBe(
      `${BRIDGE_HOST}/reset-password?token=${encodeURIComponent(token)}`
    );
  });

  it('strips trailing slash from baseUrl to avoid double slashes', () => {
    expect(buildDeepLinkBridgeUrl('reset-password', 'abc', `${BRIDGE_HOST}/`)).toBe(
      `${BRIDGE_HOST}/reset-password?token=abc`
    );
  });
});

describe('buildVerificationBridgeUrl', () => {
  it('extracts token from a BetterAuth verification URL and returns an HTTPS bridge URL', () => {
    const url = 'https://api.ceolx.com/api/auth/verify-email?token=abc123xyz';
    expect(buildVerificationBridgeUrl(url, BRIDGE_HOST)).toBe(
      `${BRIDGE_HOST}/verify-email?token=abc123xyz`
    );
  });

  it('URL-encodes tokens containing special characters', () => {
    // BetterAuth tokens are URL-safe, but defend in depth.
    const token = 'eyJhbGciOiJIUzI1NiJ9.somePayload.signature';
    const url = `https://api.ceolx.com/api/auth/verify-email?token=${encodeURIComponent(token)}`;
    const result = buildVerificationBridgeUrl(url, BRIDGE_HOST);
    // encodeURIComponent re-encodes the dots/dashes that searchParams already decoded
    expect(result).toBe(`${BRIDGE_HOST}/verify-email?token=${encodeURIComponent(token)}`);
  });

  it('returns empty token when URL has no token param (bridge will reject)', () => {
    const url = 'https://api.ceolx.com/api/auth/verify-email';
    expect(buildVerificationBridgeUrl(url, BRIDGE_HOST)).toBe(`${BRIDGE_HOST}/verify-email?token=`);
  });

  it('ignores extra query params and only forwards the token', () => {
    const url = 'https://api.ceolx.com/api/auth/verify-email?token=tok999&callbackURL=%2F';
    expect(buildVerificationBridgeUrl(url, BRIDGE_HOST)).toBe(
      `${BRIDGE_HOST}/verify-email?token=tok999`
    );
  });

  it('strips trailing slash from baseUrl to avoid double slashes', () => {
    const url = 'https://api.ceolx.com/api/auth/verify-email?token=abc';
    expect(buildVerificationBridgeUrl(url, `${BRIDGE_HOST}/`)).toBe(
      `${BRIDGE_HOST}/verify-email?token=abc`
    );
  });
});
