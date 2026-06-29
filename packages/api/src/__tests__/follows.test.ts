import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { UserRole } from '@CeolX/shared';

// ─── Hoisted mocks ──────────────────────────────────────────────────────────

const {
  mockUserFindFirst,
  mockArtistFindFirst,
  mockVenueFindFirst,
  mockInsertReturning,
  mockSelectChain,
  mockDeleteWhere,
} = vi.hoisted(() => {
  const mockUserFindFirst = vi.fn();
  const mockArtistFindFirst = vi.fn();
  const mockVenueFindFirst = vi.fn();
  const mockInsertReturning = vi.fn();
  const mockDeleteWhere = vi.fn();

  // Chain: db.select(...).from(...).where(...).orderBy(...).limit(...).offset(...)
  // Each call returns the same chain for flexibility
  const mockSelectChain = vi.fn();

  return {
    mockUserFindFirst,
    mockArtistFindFirst,
    mockVenueFindFirst,
    mockInsertReturning,
    mockSelectChain,
    mockDeleteWhere,
  };
});

vi.mock('@CeolX/db', () => {
  // The chain is thenable: all methods keep returning chain; awaiting it pulls the next
  // mockSelectChain value. This lets a query terminate on any method (.limit, .offset, .where, .groupBy).
  const chain = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    offset: vi.fn(() => chain),
    groupBy: vi.fn(() => chain),
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      (mockSelectChain() as Promise<unknown>).then(resolve, reject),
  };

  return {
    db: {
      query: {
        user: { findFirst: mockUserFindFirst },
        artistProfiles: { findFirst: mockArtistFindFirst },
        venueProfiles: { findFirst: mockVenueFindFirst },
      },
      select: vi.fn(() => chain),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: mockInsertReturning,
        })),
      })),
      delete: vi.fn(() => ({
        where: mockDeleteWhere,
      })),
    },
  };
});

vi.mock('@CeolX/db/schema/events', () => ({
  events: {
    id: 'id',
    createdBy: 'created_by',
    status: 'status',
  },
}));

vi.mock('@CeolX/db/schema/social', () => ({
  follows: {
    id: 'id',
    followerId: 'follower_id',
    followeeId: 'followee_id',
    createdAt: 'created_at',
  },
}));
vi.mock('@CeolX/db/schema/auth', () => ({
  user: { id: 'id', name: 'name', image: 'image', currentRole: 'current_role' },
}));
vi.mock('@CeolX/db/schema/users', () => ({
  artistProfiles: {
    id: 'id',
    userId: 'user_id',
    stageName: 'stage_name',
    profileImageUrl: 'profile_image_url',
    genres: 'genres',
    isActive: 'is_active',
    venueName: undefined,
  },
  venueProfiles: {
    id: 'id',
    userId: 'user_id',
    venueName: 'venue_name',
    profileImageUrl: 'profile_image_url',
    isActive: 'is_active',
  },
}));

import { t } from '../index';
import { followsRouter } from '../routers/follows';

// ─── Helper ──────────────────────────────────────────────────────────────────

const createCaller = t.createCallerFactory(followsRouter);

function authedCaller(userId = 'user-1') {
  return createCaller({
    session: {
      user: {
        id: userId,
        currentRole: 'spectator' as UserRole,
      },
    },
    userId,
    currentRole: 'spectator' as UserRole,
  } as never);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('follows router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('follow', () => {
    it('rejects self-follow with BAD_REQUEST', async () => {
      const caller = authedCaller('user-1');
      await expect(caller.follow({ followeeId: 'user-1' })).rejects.toThrow(TRPCError);
      await expect(caller.follow({ followeeId: 'user-1' })).rejects.toMatchObject({
        code: 'BAD_REQUEST',
      });
    });

    it('returns NOT_FOUND when followee user does not exist', async () => {
      mockUserFindFirst.mockResolvedValueOnce(null);
      const caller = authedCaller('user-1');
      await expect(caller.follow({ followeeId: 'user-2' })).rejects.toMatchObject({
        code: 'NOT_FOUND',
        message: 'User not found',
      });
    });

    it('returns NOT_FOUND when followee has no public profile (bare spectator)', async () => {
      mockUserFindFirst.mockResolvedValueOnce({ id: 'user-2' });
      mockArtistFindFirst.mockResolvedValueOnce(null);
      mockVenueFindFirst.mockResolvedValueOnce(null);

      const caller = authedCaller('user-1');
      await expect(caller.follow({ followeeId: 'user-2' })).rejects.toMatchObject({
        code: 'NOT_FOUND',
        message: 'User has no public profile',
      });
    });

    // Regression: an inactive venue (subscription not yet active) is still visible
    // via venues.byId, so its Follow button must work. Previously follow gated on
    // isActive=true and 404'd these accounts (e.g. "Vivek Venue"). The follow guard
    // now checks profile presence only, so an inactive profile is followable.
    it('creates follow for a followee whose only profile is an inactive venue', async () => {
      const followRow = {
        id: 'f-2',
        followerId: 'user-1',
        followeeId: 'user-v',
        createdAt: new Date(),
      };
      mockUserFindFirst.mockResolvedValueOnce({ id: 'user-v' });
      mockArtistFindFirst.mockResolvedValueOnce(null);
      mockVenueFindFirst.mockResolvedValueOnce({ id: 'vp-1' }); // inactive venue still returned
      mockInsertReturning.mockResolvedValueOnce([followRow]);

      const caller = authedCaller('user-1');
      const result = await caller.follow({ followeeId: 'user-v' });
      expect(result).toEqual(followRow);
    });

    it('returns CONFLICT on duplicate follow', async () => {
      mockUserFindFirst.mockResolvedValueOnce({ id: 'user-2' });
      mockArtistFindFirst.mockResolvedValueOnce({ id: 'ap-1', isActive: true });
      mockInsertReturning.mockRejectedValueOnce({ code: '23505' });

      const caller = authedCaller('user-1');
      await expect(caller.follow({ followeeId: 'user-2' })).rejects.toMatchObject({
        code: 'CONFLICT',
      });
    });

    it('creates follow and returns the row', async () => {
      const followRow = {
        id: 'f-1',
        followerId: 'user-1',
        followeeId: 'user-2',
        createdAt: new Date(),
      };
      mockUserFindFirst.mockResolvedValueOnce({ id: 'user-2' });
      mockArtistFindFirst.mockResolvedValueOnce({ id: 'ap-1', isActive: true });
      mockInsertReturning.mockResolvedValueOnce([followRow]);

      const caller = authedCaller('user-1');
      const result = await caller.follow({ followeeId: 'user-2' });
      expect(result).toEqual(followRow);
    });
  });

  describe('unfollow', () => {
    it('returns NOT_FOUND when follow does not exist', async () => {
      mockSelectChain.mockResolvedValueOnce([]);
      const caller = authedCaller('user-1');
      await expect(caller.unfollow({ followeeId: 'user-2' })).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('deletes follow and returns success', async () => {
      mockSelectChain.mockResolvedValueOnce([{ id: 'f-1' }]);
      mockDeleteWhere.mockResolvedValueOnce(undefined);

      const caller = authedCaller('user-1');
      const result = await caller.unfollow({ followeeId: 'user-2' });
      expect(result).toEqual({ success: true });
    });
  });

  describe('isFollowing', () => {
    it('returns true when follow exists', async () => {
      mockSelectChain.mockResolvedValueOnce([{ id: 'f-1' }]);
      const caller = authedCaller('user-1');
      const result = await caller.isFollowing({ userId: 'user-2' });
      expect(result).toEqual({ isFollowing: true });
    });

    it('returns false when follow does not exist', async () => {
      mockSelectChain.mockResolvedValueOnce([]);
      const caller = authedCaller('user-1');
      const result = await caller.isFollowing({ userId: 'user-2' });
      expect(result).toEqual({ isFollowing: false });
    });
  });

  describe('getFollowing', () => {
    // Mock sequence for a single followed user, in code order:
    //   1) followRows  query        (terminates at .offset)
    //   2) count       query        (terminates at .where via thenable)
    //   3) artist lookup for row0   (terminates at .limit)
    //   4) venue  lookup for row0   (terminates at .limit)
    //   5) events count batch       (terminates at .groupBy)
    //   6) viewer-follow set        (terminates at .where)
    it('returns venue profileImageUrl and eventsCount for a followed venue', async () => {
      const followRow = { id: 'f-1', followeeId: 'user-v', createdAt: new Date() };
      mockSelectChain.mockResolvedValueOnce([followRow]);
      mockSelectChain.mockResolvedValueOnce([{ count: 1 }]);
      mockSelectChain.mockResolvedValueOnce([]); // no artist profile
      mockSelectChain.mockResolvedValueOnce([
        {
          id: 'vp-1',
          userId: 'user-v',
          displayName: 'Kilkee Hall',
          profileImageUrl: 'https://cdn/venues/kilkee.jpg',
          isActive: true,
        },
      ]);
      mockSelectChain.mockResolvedValueOnce([{ createdBy: 'user-v', count: 7 }]);
      mockSelectChain.mockResolvedValueOnce([{ followeeId: 'user-v' }]); // viewer follows this venue

      const caller = authedCaller('user-1');
      const result = await caller.getFollowing({ limit: 50, offset: 0 });

      expect(result.following).toHaveLength(1);
      expect(result.following[0]?.profileType).toBe('venue');
      expect(result.following[0]?.profile?.profileImageUrl).toBe('https://cdn/venues/kilkee.jpg');
      expect(result.following[0]?.eventsCount).toBe(7);
      // Viewing own list: viewer follows everyone here → toggle shows "Following".
      expect(result.following[0]?.isFollowedByViewer).toBe(true);
      expect(result.following[0]?.isSelf).toBe(false);
    });

    // Target-scoping: viewer (user-1) reads ANOTHER user's (user-b) Following list.
    // The list contents come from user-b, but isFollowedByViewer reflects whether
    // user-1 follows each followee — so the toggle stays viewer-relative.
    it('scopes the list to input.userId while keeping the toggle viewer-relative', async () => {
      const followRow = { id: 'f-9', followeeId: 'user-x', createdAt: new Date() };
      mockSelectChain.mockResolvedValueOnce([followRow]); // followRows (user-b's follows)
      mockSelectChain.mockResolvedValueOnce([{ count: 1 }]); // total
      mockSelectChain.mockResolvedValueOnce([
        {
          id: 'ap-x',
          userId: 'user-x',
          displayName: 'Trad Star',
          profileImageUrl: 'https://cdn/x.jpg',
          genres: ['trad'],
          isActive: true,
        },
      ]); // artist lookup
      mockSelectChain.mockResolvedValueOnce([]); // venue lookup
      mockSelectChain.mockResolvedValueOnce([{ createdBy: 'user-x', count: 2 }]); // events
      mockSelectChain.mockResolvedValueOnce([]); // viewer-follow set — viewer does NOT follow user-x

      const caller = authedCaller('user-1');
      const result = await caller.getFollowing({ userId: 'user-b', limit: 50, offset: 0 });

      expect(result.following).toHaveLength(1);
      expect(result.following[0]?.followeeId).toBe('user-x');
      expect(result.following[0]?.isFollowedByViewer).toBe(false);
    });

    // Regression guard for the de-gate fix (Asana 1215489113550392): the per-row
    // profile lookup no longer filters on isActive, so a followed venue whose
    // subscription is inactive (the default while gating is deferred) must still
    // appear in the list — matching venues.byId. The code comment anticipates a
    // future revert ("restore the active gate once subscriptions are live"); this
    // test fails if that gate is reintroduced on the list lookup.
    // The count query is now de-gated to match: profile-presence only, so an
    // inactive venue is both listed AND counted. The mocked count value here
    // reflects the SQL's intent (1 inactive venue = 1 counted); a regression that
    // re-adds the isActive gate would make the real count exclude this followee
    // while the list still shows it, reviving the badge/list mismatch.
    it('keeps a followed inactive venue in the list and the count (de-gated)', async () => {
      const followRow = { id: 'f-iv', followeeId: 'user-iv', createdAt: new Date() };
      mockSelectChain.mockResolvedValueOnce([followRow]); // followRows
      mockSelectChain.mockResolvedValueOnce([{ count: 1 }]); // total — counts the inactive venue
      mockSelectChain.mockResolvedValueOnce([]); // no artist profile
      mockSelectChain.mockResolvedValueOnce([
        {
          id: 'vp-iv',
          userId: 'user-iv',
          displayName: 'Dormant Venue',
          profileImageUrl: 'https://cdn/venues/dormant.jpg',
          isActive: false, // subscription not active — still visible
        },
      ]); // venue lookup
      mockSelectChain.mockResolvedValueOnce([{ createdBy: 'user-iv', count: 0 }]); // events
      mockSelectChain.mockResolvedValueOnce([{ followeeId: 'user-iv' }]); // viewer-follow set

      const caller = authedCaller('user-1');
      const result = await caller.getFollowing({ limit: 50, offset: 0 });

      expect(result.following).toHaveLength(1);
      expect(result.following[0]?.profileType).toBe('venue');
      expect(result.following[0]?.profile?.displayName).toBe('Dormant Venue');
      // Count matches the rendered list — the divergence fix.
      expect(result.totalCount).toBe(1);
    });

    it('excludes the current user from their own following list', async () => {
      // A self-follow row (legacy data created before the mutation guard existed)
      // that has a real active profile would survive the profile-presence filter,
      // so it must be dropped explicitly because it is the viewer themselves.
      const selfRow = { id: 'f-self', followeeId: 'user-1', createdAt: new Date() };
      mockSelectChain.mockResolvedValueOnce([selfRow]); // followRows
      mockSelectChain.mockResolvedValueOnce([{ count: 1 }]); // total
      mockSelectChain.mockResolvedValueOnce([
        {
          id: 'ap-self',
          userId: 'user-1',
          displayName: 'Me Myself',
          profileImageUrl: 'https://cdn/me.jpg',
          genres: ['trad'],
          isActive: true,
        },
      ]); // artist lookup (self) — gives the row a real profile
      mockSelectChain.mockResolvedValueOnce([]); // venue lookup
      // No events-count query is queued: once the self row is filtered out the
      // list is empty, so getActiveEventsCounts short-circuits without a query.

      const caller = authedCaller('user-1');
      const result = await caller.getFollowing({ limit: 50, offset: 0 });

      expect(result.following).toHaveLength(0);
    });
  });

  describe('getFollowers', () => {
    // Mock sequence for getFollowers, in code order:
    //   1) followRows  query                            (terminates at .offset)
    //   2) count       query                            (terminates at .where)
    //   3) artists batch query  (Promise.all index 0)   (terminates at .where)
    //   4) venues  batch query  (Promise.all index 1)   (terminates at .where)
    //   5) baseUsers batch      (Promise.all index 2)   (terminates at .where)
    //   6) followBack rows      (Promise.all index 3)   (terminates at .where)
    //   7) events count batch   (Promise.all index 4)   (terminates at .groupBy)

    it('returns empty list when user has no followers', async () => {
      mockSelectChain.mockResolvedValueOnce([]); // followRows
      mockSelectChain.mockResolvedValueOnce([{ count: 0 }]); // total

      const caller = authedCaller('user-1');
      const result = await caller.getFollowers({ limit: 50, offset: 0 });

      expect(result.followers).toEqual([]);
      expect(result.totalCount).toBe(0);
      expect(result.hasNextPage).toBe(false);
    });

    it('marks a follower with no active profile as a spectator (profileType: null)', async () => {
      const followRow = { id: 'f-1', followerId: 'user-s', createdAt: new Date() };
      mockSelectChain.mockResolvedValueOnce([followRow]);
      mockSelectChain.mockResolvedValueOnce([{ count: 1 }]);
      mockSelectChain.mockResolvedValueOnce([]); // artists batch — none
      mockSelectChain.mockResolvedValueOnce([]); // venues batch — none
      mockSelectChain.mockResolvedValueOnce([
        { id: 'user-s', name: 'Spec Tator', image: 'https://cdn/u/s.jpg' },
      ]); // baseUsers
      mockSelectChain.mockResolvedValueOnce([]); // followBack — not following back
      mockSelectChain.mockResolvedValueOnce([]); // events count — none

      const caller = authedCaller('user-1');
      const result = await caller.getFollowers({ limit: 50, offset: 0 });

      expect(result.followers).toHaveLength(1);
      expect(result.followers[0]?.profileType).toBeNull();
      expect(result.followers[0]?.profile.displayName).toBe('Spec Tator');
      expect(result.followers[0]?.profile.profileImageUrl).toBe('https://cdn/u/s.jpg');
      expect(result.followers[0]?.eventsCount).toBe(0);
      expect(result.followers[0]?.isFollowedBack).toBe(false);
    });

    it('returns artist follower with eventsCount and isFollowedBack=true', async () => {
      const followRow = { id: 'f-2', followerId: 'user-a', createdAt: new Date() };
      mockSelectChain.mockResolvedValueOnce([followRow]);
      mockSelectChain.mockResolvedValueOnce([{ count: 1 }]);
      mockSelectChain.mockResolvedValueOnce([
        {
          userId: 'user-a',
          displayName: 'Brave Entertain',
          profileImageUrl: 'https://cdn/a.jpg',
          genres: ['trad'],
        },
      ]); // artists batch
      mockSelectChain.mockResolvedValueOnce([]); // venues
      mockSelectChain.mockResolvedValueOnce([
        { id: 'user-a', name: 'Brave Entertain Acc', image: null },
      ]); // baseUsers
      mockSelectChain.mockResolvedValueOnce([{ followeeId: 'user-a' }]); // followBack — yes
      mockSelectChain.mockResolvedValueOnce([{ createdBy: 'user-a', count: 27 }]); // events

      const caller = authedCaller('user-1');
      const result = await caller.getFollowers({ limit: 50, offset: 0 });

      expect(result.followers).toHaveLength(1);
      expect(result.followers[0]?.profileType).toBe('artist');
      expect(result.followers[0]?.profile.displayName).toBe('Brave Entertain');
      expect(result.followers[0]?.profile.profileImageUrl).toBe('https://cdn/a.jpg');
      expect(result.followers[0]?.eventsCount).toBe(27);
      expect(result.followers[0]?.isFollowedBack).toBe(true);
    });

    it('returns venue follower with isFollowedBack=false when not followed back', async () => {
      const followRow = { id: 'f-3', followerId: 'user-v', createdAt: new Date() };
      mockSelectChain.mockResolvedValueOnce([followRow]);
      mockSelectChain.mockResolvedValueOnce([{ count: 1 }]);
      mockSelectChain.mockResolvedValueOnce([]); // artists
      mockSelectChain.mockResolvedValueOnce([
        {
          userId: 'user-v',
          displayName: 'Kilkee Hall',
          profileImageUrl: 'https://cdn/v.jpg',
        },
      ]); // venues batch
      mockSelectChain.mockResolvedValueOnce([{ id: 'user-v', name: 'Kilkee Hall', image: null }]);
      mockSelectChain.mockResolvedValueOnce([]); // followBack — none
      mockSelectChain.mockResolvedValueOnce([{ createdBy: 'user-v', count: 3 }]);

      const caller = authedCaller('user-1');
      const result = await caller.getFollowers({ limit: 50, offset: 0 });

      expect(result.followers[0]?.profileType).toBe('venue');
      expect(result.followers[0]?.isFollowedBack).toBe(false);
      expect(result.followers[0]?.eventsCount).toBe(3);
    });

    // Target-scoping: viewer (user-1) reads ANOTHER user's followers list and is
    // themselves one of those followers. isSelf must be true for that row so the
    // UI suppresses the Follow toggle (you can't follow yourself).
    it('flags the viewer with isSelf when they appear in another profile followers', async () => {
      const followRow = { id: 'f-5', followerId: 'user-1', createdAt: new Date() };
      mockSelectChain.mockResolvedValueOnce([followRow]); // followRows (user-b's followers)
      mockSelectChain.mockResolvedValueOnce([{ count: 1 }]); // total
      mockSelectChain.mockResolvedValueOnce([
        {
          userId: 'user-1',
          displayName: 'Me Artist',
          profileImageUrl: 'https://cdn/me.jpg',
          genres: ['trad'],
        },
      ]); // artists batch
      mockSelectChain.mockResolvedValueOnce([]); // venues
      mockSelectChain.mockResolvedValueOnce([{ id: 'user-1', name: 'Me Artist', image: null }]); // baseUsers
      mockSelectChain.mockResolvedValueOnce([]); // followBack
      mockSelectChain.mockResolvedValueOnce([]); // events

      const caller = authedCaller('user-1');
      const result = await caller.getFollowers({ userId: 'user-b', limit: 50, offset: 0 });

      expect(result.followers).toHaveLength(1);
      expect(result.followers[0]?.isSelf).toBe(true);
    });
  });
});
