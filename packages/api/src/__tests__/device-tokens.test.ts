import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { UserRole } from '@CeolX/shared';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockOnConflictDoUpdate, mockDeleteWhere, mockDb } = vi.hoisted(() => {
  const mockOnConflictDoUpdate = vi.fn();
  const mockDeleteWhere = vi.fn();

  const insertChain = vi.fn(() => ({
    values: vi.fn(() => ({
      onConflictDoUpdate: mockOnConflictDoUpdate,
    })),
  }));

  const deleteChain = vi.fn(() => ({
    where: mockDeleteWhere,
  }));

  const mockDb = {
    insert: insertChain,
    delete: deleteChain,
  };

  return { mockOnConflictDoUpdate, mockDeleteWhere, mockDb };
});

vi.mock('@CeolX/db', () => ({ db: mockDb }));

vi.mock('@CeolX/db/schema/notifications', () => ({
  deviceTokens: {
    id: 'id',
    userId: 'user_id',
    fcmToken: 'fcm_token',
    platform: 'platform',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
}));

import type { Context } from '../context';
import { t, router } from '../index';
import { deviceTokensRouter } from '../routers/device-tokens';

const testRouter = router({ deviceTokens: deviceTokensRouter });
const createCaller = t.createCallerFactory(testRouter);

// ─── Context helpers ─────────────────────────────────────────────────────────

const USER_ID = 'user-test-1';

function authedContext(role: UserRole = 'spectator', userId = USER_ID): Context {
  return {
    session: {
      user: {
        id: userId,
        name: 'Test User',
        email: 'test@ceolx.test',
        emailVerified: true,
        image: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        currentRole: role,
        consentAt: new Date(),
        marketingConsent: false,
        lastLoginAt: null,
        flaggedInactive: false,
      },
      session: {
        id: 'test-session-id',
        token: 'test-token',
        expiresAt: new Date(Date.now() + 86_400_000),
        createdAt: new Date(),
        updatedAt: new Date(),
        userId,
        ipAddress: null,
        userAgent: null,
      },
    },
    dispatchNotification: vi.fn(async () => {}),
  };
}

function anonContext(): Context {
  return { session: null, dispatchNotification: vi.fn(async () => {}) };
}

async function expectTRPCError(promise: Promise<unknown>, code: TRPCError['code']): Promise<void> {
  try {
    await promise;
    throw new Error(`Expected a TRPCError with code ${code} but the call succeeded`);
  } catch (err) {
    if (!(err instanceof TRPCError)) throw err;
    expect(err.code).toBe(code);
  }
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── register ────────────────────────────────────────────────────────────────

describe('deviceTokens.register', () => {
  it('upserts the (userId, fcmToken) pair and returns success', async () => {
    mockOnConflictDoUpdate.mockResolvedValueOnce(undefined);

    const caller = createCaller(authedContext('spectator'));
    const result = await caller.deviceTokens.register({
      token: 'fcm-token-abc',
      platform: 'ios',
    });

    expect(result).toEqual({ success: true });
    expect(mockOnConflictDoUpdate).toHaveBeenCalledTimes(1);
  });

  it('accepts android platform', async () => {
    mockOnConflictDoUpdate.mockResolvedValueOnce(undefined);

    const caller = createCaller(authedContext('artist'));
    await expect(
      caller.deviceTokens.register({ token: 'fcm-token-xyz', platform: 'android' })
    ).resolves.toEqual({ success: true });
  });

  it('rejects empty token at validation', async () => {
    const caller = createCaller(authedContext());
    await expectTRPCError(
      caller.deviceTokens.register({ token: '', platform: 'ios' }),
      'BAD_REQUEST'
    );
  });

  it('rejects unknown platform at validation', async () => {
    const caller = createCaller(authedContext());
    await expectTRPCError(
      caller.deviceTokens.register({
        token: 'fcm-token',
        platform: 'web' as 'ios',
      }),
      'BAD_REQUEST'
    );
  });

  it('rejects unauthenticated callers', async () => {
    const caller = createCaller(anonContext());
    await expectTRPCError(
      caller.deviceTokens.register({ token: 'fcm-token', platform: 'ios' }),
      'UNAUTHORIZED'
    );
  });
});

// ─── unregister ──────────────────────────────────────────────────────────────

describe('deviceTokens.unregister', () => {
  it('deletes the token row and returns success', async () => {
    mockDeleteWhere.mockResolvedValueOnce(undefined);

    const caller = createCaller(authedContext());
    const result = await caller.deviceTokens.unregister({ token: 'fcm-token-abc' });

    expect(result).toEqual({ success: true });
    expect(mockDeleteWhere).toHaveBeenCalledTimes(1);
  });

  it('is idempotent — succeeds even if token does not exist', async () => {
    mockDeleteWhere.mockResolvedValueOnce(undefined);

    const caller = createCaller(authedContext());
    await expect(caller.deviceTokens.unregister({ token: 'nonexistent-token' })).resolves.toEqual({
      success: true,
    });
  });

  it('rejects empty token at validation', async () => {
    const caller = createCaller(authedContext());
    await expectTRPCError(caller.deviceTokens.unregister({ token: '' }), 'BAD_REQUEST');
  });

  it('rejects unauthenticated callers', async () => {
    const caller = createCaller(anonContext());
    await expectTRPCError(caller.deviceTokens.unregister({ token: 'fcm-token' }), 'UNAUTHORIZED');
  });
});
