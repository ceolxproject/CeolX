import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSelectLimit, mockUpdateSet, mockUpdateWhere, mockDb } = vi.hoisted(() => {
  const mockSelectLimit = vi.fn();
  const mockSelect = vi.fn(() => ({
    from: vi.fn(() => ({ where: vi.fn(() => ({ limit: mockSelectLimit })) })),
  }));

  const mockUpdateWhere = vi.fn().mockResolvedValue(undefined);
  const mockUpdateSet = vi.fn((_args: Record<string, unknown>) => ({ where: mockUpdateWhere }));
  const mockUpdate = vi.fn((_table: unknown) => ({ set: mockUpdateSet }));

  return {
    mockSelectLimit,
    mockUpdateSet,
    mockUpdateWhere,
    mockDb: { select: mockSelect, update: mockUpdate },
  };
});

vi.mock('@CeolX/db', () => ({ db: mockDb }));
vi.mock('@CeolX/db/schema/auth', () => ({
  user: {
    id: 'id',
    currentRole: 'current_role',
    consentAt: 'consent_at',
    marketingConsent: 'marketing_consent',
  },
}));
vi.mock('@CeolX/db/schema/users', () => ({
  artistProfiles: { userId: 'user_id' },
  venueProfiles: { userId: 'user_id' },
}));

import type { Context } from '../context';
import { router, t } from '../index';
import { usersRouter } from '../routers/users';

const testRouter = router({ users: usersRouter });
const createCaller = t.createCallerFactory(testRouter);

const USER_ID = 'user-test-1';

function buildCtx(): Context {
  return {
    session: {
      user: {
        id: USER_ID,
        name: 'Test',
        email: 'test@ceolx.test',
        emailVerified: true,
        image: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        currentRole: 'spectator',
        consentAt: new Date(),
        marketingConsent: false,
        lastLoginAt: null,
        flaggedInactive: false,
      },
      session: {
        id: 'session-1',
        token: 'tok',
        expiresAt: new Date(Date.now() + 86_400_000),
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: USER_ID,
        ipAddress: null,
        userAgent: null,
      },
    },
    dispatchNotification: vi.fn(async () => {}),
    scheduleAccountAnonymize: vi.fn(async () => {}),
  } as unknown as Context;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('users.completeRegistration', () => {
  it('writes currentRole + marketingConsent + consentAt on first call (consentAt is null)', async () => {
    mockSelectLimit.mockResolvedValueOnce([{ consentAt: null }]);

    const caller = createCaller(buildCtx());
    const result = await caller.users.completeRegistration({
      currentRole: 'artist',
      marketingConsent: true,
    });

    expect(result).toEqual({ ok: true });
    expect(mockUpdateSet).toHaveBeenCalledTimes(1);
    const setArgs = mockUpdateSet.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArgs.currentRole).toBe('artist');
    expect(setArgs.marketingConsent).toBe(true);
    expect(setArgs.consentAt).toBeInstanceOf(Date);
  });

  it('does NOT overwrite currentRole when consentAt is already set (returning user)', async () => {
    mockSelectLimit.mockResolvedValueOnce([{ consentAt: new Date('2026-01-01') }]);

    const caller = createCaller(buildCtx());
    const result = await caller.users.completeRegistration({
      currentRole: 'venue',
      marketingConsent: true,
    });

    expect(result).toEqual({ ok: true });
    expect(mockUpdateSet).not.toHaveBeenCalled();
    expect(mockUpdateWhere).not.toHaveBeenCalled();
  });

  it('does NOT overwrite when the user row is missing (defensive)', async () => {
    mockSelectLimit.mockResolvedValueOnce([]);

    const caller = createCaller(buildCtx());
    const result = await caller.users.completeRegistration({
      currentRole: 'artist',
      marketingConsent: false,
    });

    expect(result).toEqual({ ok: true });
    expect(mockUpdateSet).not.toHaveBeenCalled();
  });
});
