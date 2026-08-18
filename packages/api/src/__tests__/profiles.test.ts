import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Hoisted db mock ─────────────────────────────────────────────────────────
// getByUsername issues at most two reads, both select().from().where().limit():
//   1. user row (id + currentRole) by normalized username
//   2. artist_profiles OR venue_profiles row by user id
// so each case seeds mockSelectLimit with one value per expected read.
//
// For a venue with the gate ON there is a third read: the shared venue gate's
// select().from().leftJoin().where() — no .limit — which is why the chain below
// branches. Seed it with mockGateWhere.
const { mockSelectLimit, mockGateWhere, mockDb } = vi.hoisted(() => {
  const mockSelectLimit = vi.fn();
  const mockGateWhere = vi.fn();
  const mockDb: Record<string, unknown> = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({ limit: mockSelectLimit })),
        leftJoin: vi.fn(() => ({ where: mockGateWhere })),
      })),
    })),
  };
  return { mockSelectLimit, mockGateWhere, mockDb };
});

vi.mock('@CeolX/db', () => ({ db: mockDb }));
vi.mock('@CeolX/db/schema/auth', () => ({
  user: { id: 'id', currentRole: 'current_role', username: 'username' },
}));
vi.mock('@CeolX/db/schema/users', () => ({
  artistProfiles: {
    id: 'id',
    userId: 'user_id',
    stageName: 'stage_name',
    bio: 'bio',
    profileImageUrl: 'profile_image_url',
    isActive: 'is_active',
  },
  venueProfiles: {
    id: 'id',
    userId: 'user_id',
    venueName: 'venue_name',
    bio: 'bio',
    profileImageUrl: 'profile_image_url',
    // is_active was dropped in M8-T1 (D-14) — visibility comes from
    // subscription_status via venueVisibilityFor().
    subscriptionStatus: 'subscription_status',
  },
}));

import type { Context } from '../context';
import { t, router } from '../index';
import { profilesRouter } from '../routers/profiles';

const testRouter = router({ profiles: profilesRouter });
const createCaller = t.createCallerFactory(testRouter);

// Public procedure: an anonymous viewer has no session.
const anon = (): Context => ({ session: null }) as unknown as Context;
const viewer = (id: string): Context =>
  ({ session: { user: { id }, session: { id: 's' } } }) as unknown as Context;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('profiles.getByUsername', () => {
  it('returns the artist profile for a live artist handle (anonymous viewer)', async () => {
    mockSelectLimit
      .mockResolvedValueOnce([{ id: 'u1', currentRole: 'artist' }])
      .mockResolvedValueOnce([
        {
          userId: 'u1',
          displayName: 'Priya',
          bio: 'trad fiddle',
          image: 'img.jpg',
          isActive: true,
        },
      ]);

    const res = await createCaller(anon()).profiles.getByUsername({ username: 'priyamusic' });

    // `visibility` is on both branches now, so the shape no longer depends on role —
    // a client reading it used to get `undefined` for artists.
    expect(res).toEqual({ role: 'artist', userId: 'u1', visibility: 'visible' });
  });

  it('404s an inactive artist for a non-owner', async () => {
    mockSelectLimit
      .mockResolvedValueOnce([{ id: 'u1', currentRole: 'artist' }])
      .mockResolvedValueOnce([
        { userId: 'u1', displayName: 'Priya', bio: null, image: null, isActive: false },
      ]);

    await expect(
      createCaller(anon()).profiles.getByUsername({ username: 'priyamusic' })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('returns an inactive artist to the owner (owner-bypass)', async () => {
    mockSelectLimit
      .mockResolvedValueOnce([{ id: 'u1', currentRole: 'artist' }])
      .mockResolvedValueOnce([
        { userId: 'u1', displayName: 'Priya', bio: null, image: null, isActive: false },
      ]);

    const res = await createCaller(viewer('u1')).profiles.getByUsername({ username: 'priyamusic' });
    expect(res.role).toBe('artist');
    expect(res.userId).toBe('u1');
  });

  // Rewritten in M8-T1. This previously asserted that an unsubscribed venue
  // resolved normally "gate currently disabled". The gate now exists, so the
  // behaviour is pinned at both switch positions — and critically, an unpaid venue
  // resolves to `on_hold` rather than 404-ing, because a handle that exists must
  // not read as a missing page (D-52).
  it('resolves an unsubscribed venue while the gate is off', async () => {
    mockSelectLimit
      .mockResolvedValueOnce([{ id: 'v1', currentRole: 'venue' }])
      .mockResolvedValueOnce([
        {
          id: 'vp1',
          userId: 'v1',
          displayName: 'The Cobblestone',
          bio: null,
          image: null,
          subscriptionStatus: 'inactive',
        },
      ]);

    const res = await createCaller(anon()).profiles.getByUsername({ username: 'thecobblestone' });

    expect(res).toEqual({ role: 'venue', userId: 'v1', visibility: 'visible' });
  });

  it('resolves an unsubscribed venue as on_hold when the gate is on, never 404', async () => {
    vi.stubEnv('VENUE_GATE_ENABLED', 'true');
    vi.resetModules();
    const { profilesRouter: gatedRouter } = await import('../routers/profiles');
    const gated = router({ profiles: gatedRouter });

    mockSelectLimit
      .mockResolvedValueOnce([{ id: 'v1', currentRole: 'venue' }])
      .mockResolvedValueOnce([
        {
          id: 'vp1',
          userId: 'v1',
          displayName: 'The Cobblestone',
          bio: null,
          image: null,
          subscriptionStatus: 'inactive',
        },
      ]);
    // No billing row was ever created for this venue — the LEFT join case.
    mockGateWhere.mockResolvedValue([
      {
        venueId: 'vp1',
        userId: 'v1',
        subscriptionStatus: 'inactive',
        pastDueSince: null,
        billingBlocked: null,
      },
    ]);

    const res = await t
      .createCallerFactory(gated)(anon() as unknown as Context)
      .profiles.getByUsername({ username: 'thecobblestone' });

    expect(res).toEqual({ role: 'venue', userId: 'v1', visibility: 'on_hold' });
  });

  it('keeps a trialing venue fully visible with the gate on (D-28)', async () => {
    vi.stubEnv('VENUE_GATE_ENABLED', 'true');
    vi.resetModules();
    const { profilesRouter: gatedRouter } = await import('../routers/profiles');
    const gated = router({ profiles: gatedRouter });

    mockSelectLimit
      .mockResolvedValueOnce([{ id: 'v1', currentRole: 'venue' }])
      .mockResolvedValueOnce([
        {
          id: 'vp1',
          userId: 'v1',
          displayName: 'The Cobblestone',
          bio: null,
          image: null,
          subscriptionStatus: 'trialing',
        },
      ]);
    mockGateWhere.mockResolvedValue([
      {
        venueId: 'vp1',
        userId: 'v1',
        subscriptionStatus: 'trialing',
        pastDueSince: null,
        billingBlocked: false,
      },
    ]);

    const res = await t
      .createCallerFactory(gated)(anon() as unknown as Context)
      .profiles.getByUsername({ username: 'thecobblestone' });

    expect(res).toEqual({ role: 'venue', userId: 'v1', visibility: 'visible' });
  });

  it('404s an unknown handle', async () => {
    mockSelectLimit.mockResolvedValueOnce([]);

    await expect(
      createCaller(anon()).profiles.getByUsername({ username: 'nobody' })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('404s a spectator handle (no public profile) without a profile lookup', async () => {
    mockSelectLimit.mockResolvedValueOnce([{ id: 's1', currentRole: 'spectator' }]);

    await expect(
      createCaller(anon()).profiles.getByUsername({ username: 'somefan' })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    // only the user lookup ran — the spectator branch throws before any profile read
    expect(mockSelectLimit).toHaveBeenCalledTimes(1);
  });

  it('404s a reserved/malformed handle before touching the DB', async () => {
    await expect(
      createCaller(anon()).profiles.getByUsername({ username: 'admin' })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    // reserved word fails usernameSchema -> rejected before any lookup
    expect(mockSelectLimit).not.toHaveBeenCalled();
  });

  it('rejects TRPCError type for not-found', async () => {
    mockSelectLimit.mockResolvedValueOnce([]);
    await expect(
      createCaller(anon()).profiles.getByUsername({ username: 'nobody' })
    ).rejects.toBeInstanceOf(TRPCError);
  });
});
