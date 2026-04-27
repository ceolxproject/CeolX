import { TRPCError } from '@trpc/server';
import { describe, expect, it, vi } from 'vitest';

import type { UserRole } from '@CeolX/shared';

import type { Context } from '../context';
import {
  adminProcedure,
  artistProcedure,
  creatorProcedure,
  protectedProcedure,
  router,
  t,
  venueProcedure,
} from '../index';

// ─── Test router ─────────────────────────────────────────────────────────────

const testRouter = router({
  protected: protectedProcedure.query(({ ctx }) => ({
    userId: ctx.userId,
    currentRole: ctx.currentRole,
  })),
  admin: adminProcedure.query(() => 'admin-ok'),
  artist: artistProcedure.query(() => 'artist-ok'),
  venue: venueProcedure.query(() => 'venue-ok'),
  creator: creatorProcedure.query(() => 'creator-ok'),
});

const createCaller = t.createCallerFactory(testRouter);

// ─── Context helpers ──────────────────────────────────────────────────────────

function anonContext(): Context {
  return { session: null, dispatchNotification: vi.fn(async () => {}) };
}

function authedContext(role: UserRole, userId = 'test-user-id'): Context {
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
  } as unknown as Context;
}

// ─── Error assertion helper ───────────────────────────────────────────────────

async function expectTRPCError(promise: Promise<unknown>, code: TRPCError['code']): Promise<void> {
  try {
    await promise;
    throw new Error(`Expected a TRPCError with code ${code} but the call succeeded`);
  } catch (err) {
    if (!(err instanceof TRPCError)) throw err;
    expect(err.code).toBe(code);
  }
}

// ─── protectedProcedure ───────────────────────────────────────────────────────

describe('protectedProcedure', () => {
  it('throws UNAUTHORIZED for unauthenticated request', async () => {
    const caller = createCaller(anonContext());
    await expectTRPCError(caller.protected(), 'UNAUTHORIZED');
  });

  it('passes and exposes userId and currentRole', async () => {
    const caller = createCaller(authedContext('spectator', 'user-123'));
    const result = await caller.protected();
    expect(result).toEqual({ userId: 'user-123', currentRole: 'spectator' });
  });

  it('passes for artist role', async () => {
    const caller = createCaller(authedContext('artist'));
    const result = await caller.protected();
    expect(result.currentRole).toBe('artist');
  });
});

// ─── adminProcedure ───────────────────────────────────────────────────────────

describe('adminProcedure', () => {
  it('throws UNAUTHORIZED for unauthenticated request', async () => {
    const caller = createCaller(anonContext());
    await expectTRPCError(caller.admin(), 'UNAUTHORIZED');
  });

  it('throws FORBIDDEN for spectator', async () => {
    const caller = createCaller(authedContext('spectator'));
    await expectTRPCError(caller.admin(), 'FORBIDDEN');
  });

  it('throws FORBIDDEN for artist', async () => {
    const caller = createCaller(authedContext('artist'));
    await expectTRPCError(caller.admin(), 'FORBIDDEN');
  });

  it('throws FORBIDDEN for venue', async () => {
    const caller = createCaller(authedContext('venue'));
    await expectTRPCError(caller.admin(), 'FORBIDDEN');
  });

  it('passes for admin role', async () => {
    const caller = createCaller(authedContext('admin'));
    await expect(caller.admin()).resolves.toBe('admin-ok');
  });
});

// ─── artistProcedure ─────────────────────────────────────────────────────────

describe('artistProcedure', () => {
  it('throws UNAUTHORIZED for unauthenticated request', async () => {
    const caller = createCaller(anonContext());
    await expectTRPCError(caller.artist(), 'UNAUTHORIZED');
  });

  it('throws FORBIDDEN for spectator', async () => {
    const caller = createCaller(authedContext('spectator'));
    await expectTRPCError(caller.artist(), 'FORBIDDEN');
  });

  it('throws FORBIDDEN for venue', async () => {
    const caller = createCaller(authedContext('venue'));
    await expectTRPCError(caller.artist(), 'FORBIDDEN');
  });

  it('passes for artist role', async () => {
    const caller = createCaller(authedContext('artist'));
    await expect(caller.artist()).resolves.toBe('artist-ok');
  });

  it('admin bypasses artist check', async () => {
    const caller = createCaller(authedContext('admin'));
    await expect(caller.artist()).resolves.toBe('artist-ok');
  });
});

// ─── venueProcedure ──────────────────────────────────────────────────────────

describe('venueProcedure', () => {
  it('throws UNAUTHORIZED for unauthenticated request', async () => {
    const caller = createCaller(anonContext());
    await expectTRPCError(caller.venue(), 'UNAUTHORIZED');
  });

  it('throws FORBIDDEN for spectator', async () => {
    const caller = createCaller(authedContext('spectator'));
    await expectTRPCError(caller.venue(), 'FORBIDDEN');
  });

  it('throws FORBIDDEN for artist', async () => {
    const caller = createCaller(authedContext('artist'));
    await expectTRPCError(caller.venue(), 'FORBIDDEN');
  });

  it('passes for venue role', async () => {
    const caller = createCaller(authedContext('venue'));
    await expect(caller.venue()).resolves.toBe('venue-ok');
  });

  it('admin bypasses venue check', async () => {
    const caller = createCaller(authedContext('admin'));
    await expect(caller.venue()).resolves.toBe('venue-ok');
  });
});

// ─── creatorProcedure ────────────────────────────────────────────────────────

describe('creatorProcedure', () => {
  it('throws FORBIDDEN for spectator', async () => {
    const caller = createCaller(authedContext('spectator'));
    await expectTRPCError(caller.creator(), 'FORBIDDEN');
  });

  it('passes for artist role', async () => {
    const caller = createCaller(authedContext('artist'));
    await expect(caller.creator()).resolves.toBe('creator-ok');
  });

  it('passes for venue role', async () => {
    const caller = createCaller(authedContext('venue'));
    await expect(caller.creator()).resolves.toBe('creator-ok');
  });

  it('admin bypasses creator check', async () => {
    const caller = createCaller(authedContext('admin'));
    await expect(caller.creator()).resolves.toBe('creator-ok');
  });
});
