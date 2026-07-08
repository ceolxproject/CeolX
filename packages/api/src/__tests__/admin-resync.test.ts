import { TRPCError } from '@trpc/server';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import type { UserRole } from '@CeolX/shared';

// ─── Mocks ──────────────────────────────────────────────────────────────────
// resyncEvents composes two side-effecting helpers. Mock both so the test
// asserts orchestration (ensure-then-sync, return shape, RBAC) without touching
// Typesense or the DB.
const mockEnsureCollection = vi.fn(() => Promise.resolve());
const mockBulkSync = vi.fn(() => Promise.resolve({ synced: 0 }));

// Mock @CeolX/db so importing the admin router doesn't trigger env validation
// (the real db index validates DATABASE_URL at load). resyncEvents itself never
// touches the db — only the mocked helpers below do.
vi.mock('@CeolX/db', () => ({ db: {} }));
vi.mock('../lib/typesense-collections', () => ({
  ensureEventsCollection: () => mockEnsureCollection(),
}));
vi.mock('../services/event-sync', () => ({
  bulkSyncEventsToTypesense: () => mockBulkSync(),
}));

import type { Context } from '../context';
import { t, router } from '../index';
import { adminRouter } from '../routers/admin';

const testRouter = router({ admin: adminRouter });
const createCaller = t.createCallerFactory(testRouter);

function authedContext(role: UserRole = 'admin'): Context {
  return {
    session: {
      user: {
        id: 'admin-user-1',
        name: 'Admin',
        email: 'admin@ceolx.com',
        emailVerified: true,
        image: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        currentRole: role,
        consentAt: new Date(),
        marketingConsent: false,
        lastLoginAt: null,
        flaggedInactive: false,
        isAnonymized: false,
      },
      session: {
        id: 'sess-1',
        token: 'tok',
        expiresAt: new Date(Date.now() + 86_400_000),
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: 'admin-user-1',
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
    throw new Error(`Expected TRPCError ${code} but call succeeded`);
  } catch (err) {
    if (!(err instanceof TRPCError)) throw err;
    expect(err.code).toBe(code);
  }
}

describe('admin.resyncEvents', () => {
  beforeEach(() => {
    mockEnsureCollection.mockClear();
    mockBulkSync.mockClear();
  });

  it('ensures the collection then bulk-syncs and returns the synced count', async () => {
    mockBulkSync.mockResolvedValueOnce({ synced: 7 });
    const caller = createCaller(authedContext('admin'));

    const result = await caller.admin.resyncEvents();

    expect(mockEnsureCollection).toHaveBeenCalledOnce();
    expect(mockBulkSync).toHaveBeenCalledOnce();
    expect(result).toEqual({ collectionReady: true, synced: 7 });
  });

  it('rejects non-admin roles with FORBIDDEN', async () => {
    const caller = createCaller(authedContext('artist'));
    await expectTRPCError(caller.admin.resyncEvents(), 'FORBIDDEN');
    expect(mockBulkSync).not.toHaveBeenCalled();
  });

  it('rejects anonymous callers with UNAUTHORIZED', async () => {
    const caller = createCaller(anonContext());
    await expectTRPCError(caller.admin.resyncEvents(), 'UNAUTHORIZED');
    expect(mockEnsureCollection).not.toHaveBeenCalled();
  });
});
