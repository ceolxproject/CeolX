import { describe, expect, it } from 'vitest';

import {
  EXPORT_MAX_ROWS,
  computePagination,
  osFromUserAgent,
  shapeRichUserRow,
  shapeUserRow,
  type RawRichUserRow,
  type RawUserRow,
} from '../lib/admin-users';

describe('computePagination', () => {
  it('returns total pages for a perfect multiple', () => {
    expect(computePagination({ total: 100, page: 1, limit: 20 })).toEqual({
      page: 1,
      limit: 20,
      total: 100,
      totalPages: 5,
    });
  });

  it('rounds up to the next page when there is a remainder', () => {
    expect(computePagination({ total: 247, page: 1, limit: 20 }).totalPages).toBe(13);
  });

  it('returns totalPages 1 when total <= limit', () => {
    expect(computePagination({ total: 5, page: 1, limit: 20 }).totalPages).toBe(1);
  });

  it('returns totalPages 0 when total is zero', () => {
    expect(computePagination({ total: 0, page: 1, limit: 20 }).totalPages).toBe(0);
  });
});

describe('shapeUserRow', () => {
  const fixedDate = new Date('2026-02-15T10:30:00Z');
  const lastLogin = new Date('2026-04-23T09:15:00Z');

  const raw: RawUserRow = {
    id: 'user_123',
    name: 'Siobhán Ní Dhubhda',
    email: 'siobhan@example.com',
    currentRole: 'artist',
    createdAt: fixedDate,
    lastLoginAt: lastLogin,
    flaggedInactive: false,
  };

  it('serializes Date fields to ISO strings for the wire', () => {
    const result = shapeUserRow(raw);
    expect(result.createdAt).toBe(fixedDate.toISOString());
    expect(result.lastLoginAt).toBe(lastLogin.toISOString());
  });

  it('serializes null lastLoginAt to null (never logged in)', () => {
    const result = shapeUserRow({ ...raw, lastLoginAt: null });
    expect(result.lastLoginAt).toBeNull();
  });

  it('preserves Irish characters as-is (UTF-8 safe)', () => {
    expect(shapeUserRow(raw).name).toBe('Siobhán Ní Dhubhda');
  });
});

describe('EXPORT_MAX_ROWS', () => {
  it('caps CSV export at a sensible V1 ceiling', () => {
    expect(EXPORT_MAX_ROWS).toBe(5000);
  });
});

describe('osFromUserAgent', () => {
  it('detects iOS from an Expo/iPhone user agent', () => {
    expect(osFromUserAgent('CeolX/1.0 CFNetwork/1410 Darwin/22.4.0')).toBe('iOS');
    expect(osFromUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)')).toBe('iOS');
  });

  it('detects Android', () => {
    expect(osFromUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8)')).toBe('Android');
  });

  it('detects desktop browsers', () => {
    expect(osFromUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('Windows');
    expect(osFromUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe('macOS');
  });

  it('returns null for missing or unrecognised agents', () => {
    expect(osFromUserAgent(null)).toBeNull();
    expect(osFromUserAgent('')).toBeNull();
    expect(osFromUserAgent('SomeUnknownBot/1.0')).toBeNull();
  });
});

describe('shapeRichUserRow', () => {
  const base: RawRichUserRow = {
    id: 'user_1',
    name: 'Aoife Murphy',
    email: 'aoife@example.com',
    currentRole: 'artist',
    lastLoginAt: null,
    flaggedInactive: null,
    emailVerified: true,
    image: null,
    venueSubscriptionStatus: null,
    artistActive: true,
    profileImageUrl: null,
    eventsCount: 3,
    authProviders: ['google'],
  };

  it('coerces a null flaggedInactive to false and serialises lastLoginAt', () => {
    const row = shapeRichUserRow({ ...base, lastLoginAt: new Date('2026-01-02T00:00:00Z') });
    expect(row.flaggedInactive).toBe(false);
    expect(row.lastLoginAt).toBe('2026-01-02T00:00:00.000Z');
    expect(shapeRichUserRow(base).lastLoginAt).toBeNull();
    expect(row.authProviders).toEqual(['google']);
  });

  it('passes the uploaded profile image through to the wire row', () => {
    expect(
      shapeRichUserRow({ ...base, profileImageUrl: 'https://cdn/p.jpg' }).profileImageUrl
    ).toBe('https://cdn/p.jpg');
    expect(shapeRichUserRow(base).profileImageUrl).toBeNull();
  });
});
