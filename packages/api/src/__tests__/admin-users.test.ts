import { describe, expect, it } from 'vitest';

import {
  EXPORT_MAX_ROWS,
  computePagination,
  shapeUserRow,
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
