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
  const chain = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    limit: vi.fn(() => mockSelectChain()),
    offset: vi.fn(() => chain),
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

    it('returns NOT_FOUND when followee has no active profile', async () => {
      mockUserFindFirst.mockResolvedValueOnce({ id: 'user-2' });
      mockArtistFindFirst.mockResolvedValueOnce(null);
      mockVenueFindFirst.mockResolvedValueOnce(null);

      const caller = authedCaller('user-1');
      await expect(caller.follow({ followeeId: 'user-2' })).rejects.toMatchObject({
        code: 'NOT_FOUND',
        message: 'User has no active profile',
      });
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
});
