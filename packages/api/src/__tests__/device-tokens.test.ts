import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { UserRole } from '@CeolX/shared';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────
//
// Drizzle's chained API is mocked manually here (no real DB hit). Each chain
// terminates in either a Promise (for awaited statements) OR a Promise-like
// that also exposes a follow-up method (`.values().onConflictDoUpdate(...)`,
// `.set().where().returning(...)`).

const { mockDb, mocks } = vi.hoisted(() => {
  const insertCalls: Array<{ table: unknown; values: unknown; onConflict?: unknown }> = [];
  const updateCalls: Array<{ table: unknown; set: unknown; where: unknown }> = [];
  const deleteCalls: Array<{ table: unknown; where: unknown }> = [];
  let selectResult: unknown[] = [];
  let updateReturningResult: unknown[] = [];
  // The ONB-01 welcome-push claim updates the `user` table; keep its
  // .returning() result independent of the device-token updates.
  let welcomeClaimResult: unknown[] = [];
  const isUserTable = (table: unknown): boolean =>
    (table as { __table?: string } | null)?.__table === 'user';

  return {
    mockDb: {
      insert: vi.fn((table: unknown) => ({
        values: vi.fn((values: unknown) => {
          const call: { table: unknown; values: unknown; onConflict?: unknown } = {
            table,
            values,
          };
          insertCalls.push(call);
          const result = Promise.resolve(undefined) as Promise<undefined> & {
            onConflictDoUpdate: (cfg: unknown) => Promise<undefined>;
          };
          result.onConflictDoUpdate = vi.fn((cfg: unknown) => {
            call.onConflict = cfg;
            return Promise.resolve(undefined);
          });
          return result;
        }),
      })),
      update: vi.fn((table: unknown) => ({
        set: vi.fn((setValues: unknown) => ({
          where: vi.fn((whereClause: unknown) => {
            updateCalls.push({ table, set: setValues, where: whereClause });
            const result = Promise.resolve(undefined) as Promise<undefined> & {
              returning: () => Promise<unknown[]>;
            };
            result.returning = vi.fn(() =>
              Promise.resolve(isUserTable(table) ? welcomeClaimResult : updateReturningResult)
            );
            return result;
          }),
        })),
      })),
      delete: vi.fn((table: unknown) => ({
        where: vi.fn((whereClause: unknown) => {
          deleteCalls.push({ table, where: whereClause });
          return Promise.resolve(undefined);
        }),
      })),
      select: vi.fn((_selection: unknown) => ({
        from: vi.fn((_table: unknown) => ({
          where: vi.fn((_whereClause: unknown) => ({
            limit: vi.fn(() => Promise.resolve(selectResult)),
          })),
        })),
      })),
    },
    mocks: {
      get insertCalls() {
        return insertCalls;
      },
      get updateCalls() {
        return updateCalls;
      },
      get deleteCalls() {
        return deleteCalls;
      },
      setSelectResult(rows: unknown[]) {
        selectResult = rows;
      },
      setUpdateReturning(rows: unknown[]) {
        updateReturningResult = rows;
      },
      setWelcomeClaim(rows: unknown[]) {
        welcomeClaimResult = rows;
      },
      // Device-token updates only (excludes the user-table welcome-push claim).
      get tokenUpdateCalls() {
        return updateCalls.filter((c) => !isUserTable(c.table));
      },
      reset() {
        insertCalls.length = 0;
        updateCalls.length = 0;
        deleteCalls.length = 0;
        selectResult = [];
        updateReturningResult = [];
        welcomeClaimResult = [];
      },
    },
  };
});

vi.mock('@CeolX/db', () => ({ db: mockDb }));

vi.mock('@CeolX/db/schema/notifications', () => ({
  deviceTokens: {
    id: 'id',
    userId: 'user_id',
    fcmToken: 'fcm_token',
    platform: 'platform',
    isActive: 'is_active',
    lastUsedAt: 'last_used_at',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
}));

vi.mock('@CeolX/db/schema/auth', () => ({
  user: {
    __table: 'user',
    id: 'id',
    welcomeSentAt: 'welcome_sent_at',
    welcomePushSentAt: 'welcome_push_sent_at',
  },
}));

import type { Context } from '../context';
import { t, router } from '../index';
import { deviceTokensRouter } from '../routers/device-tokens';

const testRouter = router({ deviceTokens: deviceTokensRouter });
const createCaller = t.createCallerFactory(testRouter);

// ─── Token fixtures ──────────────────────────────────────────────────────────
//
// Real FCM tokens are ~152 chars. The validator min(50) gate is exercised
// via SHORT_TOKEN; happy-path tests use VALID_TOKEN (60 chars).

const VALID_TOKEN = 'a'.repeat(60);
const ANOTHER_VALID_TOKEN = 'b'.repeat(60);
const SHORT_TOKEN = 'too-short'; // < 50 chars

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
    scheduleAccountAnonymize: vi.fn(async () => {}),
  };
}

function anonContext(): Context {
  return {
    session: null,
    dispatchNotification: vi.fn(async () => {}),
    scheduleAccountAnonymize: vi.fn(async () => {}),
  };
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
  mocks.reset();
});

// ─── register ────────────────────────────────────────────────────────────────

describe('deviceTokens.register', () => {
  it('inserts a new row when the token has never been seen', async () => {
    mocks.setSelectResult([]); // no row exists for this token

    const caller = createCaller(authedContext('spectator'));
    const result = await caller.deviceTokens.register({
      token: VALID_TOKEN,
      platform: 'ios',
    });

    expect(result).toEqual({ success: true });
    expect(mocks.insertCalls).toHaveLength(1);
    expect(mocks.insertCalls[0]?.values).toMatchObject({
      userId: USER_ID,
      fcmToken: VALID_TOKEN,
      platform: 'ios',
      isActive: true,
    });
    expect(mocks.tokenUpdateCalls).toHaveLength(0);
  });

  it('reassigns an existing row when the token already belongs to another user', async () => {
    // Device handed off — token row exists, but for a different user.
    mocks.setSelectResult([{ id: 'token-row-uuid' }]);

    const caller = createCaller(authedContext('artist'));
    const result = await caller.deviceTokens.register({
      token: VALID_TOKEN,
      platform: 'android',
    });

    expect(result).toEqual({ success: true });
    expect(mocks.tokenUpdateCalls).toHaveLength(1);
    expect(mocks.tokenUpdateCalls[0]?.set).toMatchObject({
      userId: USER_ID,
      platform: 'android',
      isActive: true,
    });
    expect(mocks.insertCalls).toHaveLength(0);
  });

  it('accepts android platform on a fresh insert', async () => {
    mocks.setSelectResult([]);

    const caller = createCaller(authedContext('artist'));
    await expect(
      caller.deviceTokens.register({ token: ANOTHER_VALID_TOKEN, platform: 'android' })
    ).resolves.toEqual({ success: true });
    expect(mocks.insertCalls[0]?.values).toMatchObject({ platform: 'android' });
  });

  it('rejects tokens shorter than 50 chars at validation', async () => {
    const caller = createCaller(authedContext());
    await expectTRPCError(
      caller.deviceTokens.register({ token: SHORT_TOKEN, platform: 'ios' }),
      'BAD_REQUEST'
    );
  });

  it('rejects unknown platform at validation', async () => {
    const caller = createCaller(authedContext());
    await expectTRPCError(
      caller.deviceTokens.register({
        token: VALID_TOKEN,
        platform: 'web' as 'ios',
      }),
      'BAD_REQUEST'
    );
  });

  it('rejects unauthenticated callers', async () => {
    const caller = createCaller(anonContext());
    await expectTRPCError(
      caller.deviceTokens.register({ token: VALID_TOKEN, platform: 'ios' }),
      'UNAUTHORIZED'
    );
  });
});

// ─── refresh ─────────────────────────────────────────────────────────────────

describe('deviceTokens.refresh', () => {
  it('touches lastUsedAt + reactivates when the token is already registered', async () => {
    // The .returning() call resolves to one row → existing token; no insert needed.
    mocks.setUpdateReturning([{ id: 'token-row-uuid' }]);

    const caller = createCaller(authedContext('spectator'));
    const result = await caller.deviceTokens.refresh({
      token: VALID_TOKEN,
      platform: 'ios',
    });

    expect(result).toEqual({ success: true });
    expect(mocks.tokenUpdateCalls).toHaveLength(1);
    expect(mocks.tokenUpdateCalls[0]?.set).toMatchObject({
      isActive: true,
      platform: 'ios',
    });
    expect(mocks.tokenUpdateCalls[0]?.set).toHaveProperty('lastUsedAt');
    expect(mocks.insertCalls).toHaveLength(0);
  });

  it('falls back to insert when no row matches (not yet registered for this user)', async () => {
    mocks.setUpdateReturning([]); // 0 rows updated

    const caller = createCaller(authedContext('venue'));
    const result = await caller.deviceTokens.refresh({
      token: VALID_TOKEN,
      platform: 'android',
    });

    expect(result).toEqual({ success: true });
    expect(mocks.tokenUpdateCalls).toHaveLength(1); // attempted update first
    expect(mocks.insertCalls).toHaveLength(1); // then inserted
    expect(mocks.insertCalls[0]?.values).toMatchObject({
      userId: USER_ID,
      fcmToken: VALID_TOKEN,
      platform: 'android',
      isActive: true,
    });
  });

  it('rejects short tokens', async () => {
    const caller = createCaller(authedContext());
    await expectTRPCError(
      caller.deviceTokens.refresh({ token: SHORT_TOKEN, platform: 'ios' }),
      'BAD_REQUEST'
    );
  });

  it('rejects unauthenticated callers', async () => {
    const caller = createCaller(anonContext());
    await expectTRPCError(
      caller.deviceTokens.refresh({ token: VALID_TOKEN, platform: 'ios' }),
      'UNAUTHORIZED'
    );
  });
});

// ─── onboarding welcome push (ONB-01) ───────────────────────────────────────

describe('deviceTokens — welcome push (ONB-01)', () => {
  it('register fires the push-only welcome dispatch when the claim succeeds', async () => {
    mocks.setSelectResult([]); // fresh token insert
    mocks.setWelcomeClaim([{ id: USER_ID }]); // welcome due (claimed)

    const ctx = authedContext('spectator');
    await createCaller(ctx).deviceTokens.register({ token: VALID_TOKEN, platform: 'ios' });

    // The claim targets the user table and stamps welcomePushSentAt.
    const claim = mocks.updateCalls.find(
      (c) => (c.set as Record<string, unknown>).welcomePushSentAt
    );
    expect(claim).toBeDefined();
    expect((claim?.set as Record<string, unknown>).welcomePushSentAt).toBeInstanceOf(Date);

    expect(ctx.dispatchNotification).toHaveBeenCalledTimes(1);
    expect(ctx.dispatchNotification).toHaveBeenCalledWith({
      trigger: 'user_welcome',
      recipientUserId: USER_ID,
      vars: {},
      surfaces: ['push'],
    });
  });

  it('register does NOT dispatch when the welcome push is not due (claim empty)', async () => {
    mocks.setSelectResult([]);
    mocks.setWelcomeClaim([]); // already pushed, or never welcomed (backfilled)

    const ctx = authedContext('spectator');
    await createCaller(ctx).deviceTokens.register({ token: VALID_TOKEN, platform: 'ios' });

    expect(ctx.dispatchNotification).not.toHaveBeenCalled();
  });

  it('refresh also fires the welcome push when due', async () => {
    mocks.setUpdateReturning([{ id: 'token-row-uuid' }]); // existing token
    mocks.setWelcomeClaim([{ id: USER_ID }]);

    const ctx = authedContext('artist');
    await createCaller(ctx).deviceTokens.refresh({ token: VALID_TOKEN, platform: 'android' });

    expect(ctx.dispatchNotification).toHaveBeenCalledWith(
      expect.objectContaining({ trigger: 'user_welcome', surfaces: ['push'] })
    );
  });

  it('a dispatch failure never fails token registration', async () => {
    mocks.setSelectResult([]);
    mocks.setWelcomeClaim([{ id: USER_ID }]);

    const ctx = authedContext('spectator');
    (ctx.dispatchNotification as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('qstash down')
    );

    await expect(
      createCaller(ctx).deviceTokens.register({ token: VALID_TOKEN, platform: 'ios' })
    ).resolves.toEqual({ success: true });
  });
});

// ─── unregister (soft-deactivate) ────────────────────────────────────────────

describe('deviceTokens.unregister', () => {
  it('soft-deactivates the row instead of deleting it', async () => {
    const caller = createCaller(authedContext());
    const result = await caller.deviceTokens.unregister({ token: VALID_TOKEN });

    expect(result).toEqual({ success: true });
    expect(mocks.updateCalls).toHaveLength(1);
    expect(mocks.updateCalls[0]?.set).toMatchObject({ isActive: false });
    // Hard-delete must NOT be invoked any more.
    expect(mocks.deleteCalls).toHaveLength(0);
  });

  it('is idempotent — succeeds even when no row matches', async () => {
    const caller = createCaller(authedContext());
    await expect(caller.deviceTokens.unregister({ token: VALID_TOKEN })).resolves.toEqual({
      success: true,
    });
  });

  it('rejects short tokens', async () => {
    const caller = createCaller(authedContext());
    await expectTRPCError(caller.deviceTokens.unregister({ token: SHORT_TOKEN }), 'BAD_REQUEST');
  });

  it('rejects unauthenticated callers', async () => {
    const caller = createCaller(anonContext());
    await expectTRPCError(caller.deviceTokens.unregister({ token: VALID_TOKEN }), 'UNAUTHORIZED');
  });
});

// ─── deactivateAll ───────────────────────────────────────────────────────────

describe('deviceTokens.deactivateAll', () => {
  it('flips every token belonging to the current user to isActive=false', async () => {
    const caller = createCaller(authedContext());
    const result = await caller.deviceTokens.deactivateAll();

    expect(result).toEqual({ success: true });
    expect(mocks.updateCalls).toHaveLength(1);
    expect(mocks.updateCalls[0]?.set).toMatchObject({ isActive: false });
    // No token-specific filter — only userId scopes the WHERE clause.
    expect(mocks.deleteCalls).toHaveLength(0);
  });

  it('rejects unauthenticated callers', async () => {
    const caller = createCaller(anonContext());
    await expectTRPCError(caller.deviceTokens.deactivateAll(), 'UNAUTHORIZED');
  });
});
