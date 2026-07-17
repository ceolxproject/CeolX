import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Hoisted db mock ─────────────────────────────────────────────────────────
// getByUsername issues at most two reads, both select().from().where().limit():
//   1. user row (id + currentRole) by normalized username
//   2. artist_profiles OR venue_profiles row by user id
// so each case seeds mockSelectLimit with one value per expected read.
const { mockSelectLimit, mockDb } = vi.hoisted(() => {
  const mockSelectLimit = vi.fn();
  const mockDb: Record<string, unknown> = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({ where: vi.fn(() => ({ limit: mockSelectLimit })) })),
    })),
  };
  return { mockSelectLimit, mockDb };
});

vi.mock('@CeolX/db', () => ({ db: mockDb }));
vi.mock('@CeolX/db/schema/auth', () => ({
  user: { id: 'id', currentRole: 'current_role', username: 'username' },
}));
vi.mock('@CeolX/db/schema/users', () => ({
  artistProfiles: {
    userId: 'user_id',
    stageName: 'stage_name',
    bio: 'bio',
    profileImageUrl: 'profile_image_url',
    isActive: 'is_active',
  },
  venueProfiles: {
    userId: 'user_id',
    venueName: 'venue_name',
    bio: 'bio',
    profileImageUrl: 'profile_image_url',
    isActive: 'is_active',
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

    expect(res).toEqual({ role: 'artist', userId: 'u1' });
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

  it('returns a venue even when inactive/unsubscribed (gate currently disabled)', async () => {
    mockSelectLimit
      .mockResolvedValueOnce([{ id: 'v1', currentRole: 'venue' }])
      .mockResolvedValueOnce([
        {
          userId: 'v1',
          displayName: 'The Cobblestone',
          bio: null,
          image: null,
          isActive: false,
          subscriptionStatus: 'inactive',
        },
      ]);

    const res = await createCaller(anon()).profiles.getByUsername({ username: 'thecobblestone' });

    expect(res).toEqual({ role: 'venue', userId: 'v1' });
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
