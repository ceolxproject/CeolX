// Hoisted Drizzle mocks — vi.mock is lifted above imports.

const mockSelectWhere = vi.hoisted(() => vi.fn());
const mockSelectFrom = vi.hoisted(() => vi.fn(() => ({ where: mockSelectWhere })));
const mockSelect = vi.hoisted(() => vi.fn(() => ({ from: mockSelectFrom })));

const mockUpdateWhere = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockUpdateSet = vi.hoisted(() => vi.fn(() => ({ where: mockUpdateWhere })));
const mockUpdate = vi.hoisted(() => vi.fn(() => ({ set: mockUpdateSet })));

const mockAnd = vi.hoisted(() => vi.fn((...args: unknown[]) => ({ kind: 'and', args })));
const mockEq = vi.hoisted(() => vi.fn((col: unknown, val: unknown) => ({ kind: 'eq', col, val })));
const mockLt = vi.hoisted(() => vi.fn((col: unknown, val: unknown) => ({ kind: 'lt', col, val })));
const mockInArray = vi.hoisted(() =>
  vi.fn((col: unknown, vals: unknown) => ({ kind: 'inArray', col, vals }))
);

const mockSendNotification = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('@CeolX/db', () => ({ db: { select: mockSelect, update: mockUpdate } }));
vi.mock('@CeolX/db/schema/auth', () => ({
  user: {
    id: 'id',
    email: 'email',
    name: 'name',
    lastLoginAt: 'last_login_at',
    flaggedInactive: 'flagged_inactive',
    isAnonymized: 'is_anonymized',
  },
}));
vi.mock('drizzle-orm', () => ({
  and: mockAnd,
  eq: mockEq,
  lt: mockLt,
  inArray: mockInArray,
}));
vi.mock('@CeolX/email', () => ({ sendNotificationEmail: mockSendNotification }));

import { afterEach, describe, expect, it, vi } from 'vitest';

import { handleAccountFlagInactive } from '../../jobs/handlers/inactive.js';

afterEach(() => {
  vi.clearAllMocks();
});

describe('handleAccountFlagInactive', () => {
  it('selects on lastLoginAt < ~2 years ago AND not-flagged AND not-anonymised', async () => {
    mockSelectWhere.mockResolvedValueOnce([]);

    const before = Date.now();
    await handleAccountFlagInactive({});
    const after = Date.now();

    expect(mockLt).toHaveBeenCalledTimes(1);
    const ltDate = mockLt.mock.calls[0]?.[1] as Date;
    expect(ltDate).toBeInstanceOf(Date);
    // Roughly two years before now — accept ±1 day for stability.
    const expectedMin = new Date(before);
    expectedMin.setFullYear(expectedMin.getFullYear() - 2);
    expectedMin.setDate(expectedMin.getDate() - 1);
    const expectedMax = new Date(after);
    expectedMax.setFullYear(expectedMax.getFullYear() - 2);
    expectedMax.setDate(expectedMax.getDate() + 1);
    expect(ltDate.getTime()).toBeGreaterThanOrEqual(expectedMin.getTime());
    expect(ltDate.getTime()).toBeLessThanOrEqual(expectedMax.getTime());

    // Both eq calls assert "= false" (flaggedInactive, isAnonymized)
    const eqValues = mockEq.mock.calls.map((c) => c[1]);
    expect(eqValues).toEqual([false, false]);

    expect(mockAnd).toHaveBeenCalledTimes(1);
  });

  it('flags the selected due users and warns each one with an email', async () => {
    mockSelectWhere.mockResolvedValueOnce([
      { id: 'u1', email: 'u1@x.ie', name: 'One' },
      { id: 'u2', email: 'u2@x.ie', name: 'Two' },
    ]);

    await handleAccountFlagInactive({});

    expect(mockUpdateSet).toHaveBeenCalledWith({ flaggedInactive: true });
    expect(mockInArray).toHaveBeenCalledWith('id', ['u1', 'u2']);
    expect(mockSendNotification).toHaveBeenCalledTimes(2);
    expect(mockSendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'u1@x.ie', userName: 'One', subject: 'We miss you at CeolX' })
    );
    expect(mockSendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'u2@x.ie', userName: 'Two', subject: 'We miss you at CeolX' })
    );
  });

  it('is a no-op (no update, no email) when nothing is due', async () => {
    mockSelectWhere.mockResolvedValueOnce([]);

    await handleAccountFlagInactive({});

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  it('skips users without an email address', async () => {
    mockSelectWhere.mockResolvedValueOnce([{ id: 'u1', email: null, name: 'One' }]);

    await handleAccountFlagInactive({});

    expect(mockUpdateSet).toHaveBeenCalledWith({ flaggedInactive: true });
    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  it('continues the sweep when one email send fails', async () => {
    mockSendNotification.mockRejectedValueOnce(new Error('postmark down'));
    mockSelectWhere.mockResolvedValueOnce([
      { id: 'u1', email: 'u1@x.ie', name: 'One' },
      { id: 'u2', email: 'u2@x.ie', name: 'Two' },
    ]);

    await expect(handleAccountFlagInactive({})).resolves.toBeUndefined();
    expect(mockSendNotification).toHaveBeenCalledTimes(2);
  });
});
