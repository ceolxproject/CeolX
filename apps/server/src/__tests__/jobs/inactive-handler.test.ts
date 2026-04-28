// Hoisted Drizzle mocks — vi.mock is lifted above imports.

const mockUpdateWhere = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockUpdateSet = vi.hoisted(() => vi.fn(() => ({ where: mockUpdateWhere })));
const mockUpdate = vi.hoisted(() => vi.fn(() => ({ set: mockUpdateSet })));

const mockAnd = vi.hoisted(() => vi.fn((...args: unknown[]) => ({ kind: 'and', args })));
const mockEq = vi.hoisted(() => vi.fn((col: unknown, val: unknown) => ({ kind: 'eq', col, val })));
const mockLt = vi.hoisted(() => vi.fn((col: unknown, val: unknown) => ({ kind: 'lt', col, val })));

vi.mock('@CeolX/db', () => ({ db: { update: mockUpdate } }));
vi.mock('@CeolX/db/schema/auth', () => ({
  user: {
    lastLoginAt: 'last_login_at',
    flaggedInactive: 'flagged_inactive',
    isAnonymized: 'is_anonymized',
  },
}));
vi.mock('drizzle-orm', () => ({ and: mockAnd, eq: mockEq, lt: mockLt }));

import { afterEach, describe, expect, it, vi } from 'vitest';

import { handleAccountFlagInactive } from '../../jobs/handlers/inactive.js';

afterEach(() => {
  vi.clearAllMocks();
});

describe('handleAccountFlagInactive', () => {
  it('sets flagged_inactive=true on the user table', async () => {
    await handleAccountFlagInactive({});

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdateSet).toHaveBeenCalledWith({ flaggedInactive: true });
  });

  it('filters by lastLoginAt < (now - 24 months) AND flagged_inactive=false AND isAnonymized=false', async () => {
    const before = Date.now();
    await handleAccountFlagInactive({});
    const after = Date.now();

    expect(mockLt).toHaveBeenCalledTimes(1);
    expect(mockEq).toHaveBeenCalledTimes(2);

    const ltCall = mockLt.mock.calls[0]?.[1] as Date;
    expect(ltCall).toBeInstanceOf(Date);
    // Roughly two years before "now" — accept ±1 day for test stability.
    const expectedMin = new Date(before);
    expectedMin.setFullYear(expectedMin.getFullYear() - 2);
    expectedMin.setDate(expectedMin.getDate() - 1);
    const expectedMax = new Date(after);
    expectedMax.setFullYear(expectedMax.getFullYear() - 2);
    expectedMax.setDate(expectedMax.getDate() + 1);
    expect(ltCall.getTime()).toBeGreaterThanOrEqual(expectedMin.getTime());
    expect(ltCall.getTime()).toBeLessThanOrEqual(expectedMax.getTime());

    // Both eq calls assert "= false"
    const eqValues = mockEq.mock.calls.map((c) => c[1]);
    expect(eqValues).toEqual([false, false]);

    // The composed predicate is passed via mockAnd
    expect(mockAnd).toHaveBeenCalledTimes(1);
  });
});
