import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { UserRole } from '@CeolX/shared';

// ─── Hoisted mocks ──────────────────────────────────────────────────────────

const {
  mockPostsFindFirst,
  mockPostLikesFindFirst,
  mockInsertReturning,
  mockUpdateReturning,
  mockUpdateWhereNoReturn,
  mockDeleteWhere,
  mockSelectChain,
  mockTransaction,
} = vi.hoisted(() => {
  const mockPostsFindFirst = vi.fn();
  const mockPostLikesFindFirst = vi.fn();
  const mockInsertReturning = vi.fn();
  const mockUpdateReturning = vi.fn();
  const mockUpdateWhereNoReturn = vi.fn(() => Promise.resolve());
  const mockDeleteWhere = vi.fn(() => Promise.resolve());
  const mockSelectChain = vi.fn();
  const mockInsertValuesNoReturn = vi.fn(() => Promise.resolve());

  const mockTransaction = vi.fn((cb: (tx: unknown) => Promise<unknown>) => {
    // Tx gets the same api shape as db
    return cb({
      query: {
        postLikes: { findFirst: mockPostLikesFindFirst },
      },
      insert: vi.fn(() => ({ values: mockInsertValuesNoReturn })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: mockUpdateReturning,
          })),
        })),
      })),
      delete: vi.fn(() => ({ where: mockDeleteWhere })),
    });
  });

  return {
    mockPostsFindFirst,
    mockPostLikesFindFirst,
    mockInsertReturning,
    mockUpdateReturning,
    mockUpdateWhereNoReturn,
    mockDeleteWhere,
    mockSelectChain,
    mockTransaction,
  };
});

vi.mock('@CeolX/db', () => {
  const chain = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    offset: vi.fn(() => chain),
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      (mockSelectChain() as Promise<unknown>).then(resolve, reject),
  };

  return {
    db: {
      query: {
        posts: { findFirst: mockPostsFindFirst },
        postLikes: { findFirst: mockPostLikesFindFirst },
      },
      select: vi.fn(() => chain),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: mockInsertReturning,
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: mockUpdateReturning,
            then: (resolve: (v: unknown) => unknown) => mockUpdateWhereNoReturn().then(resolve),
          })),
        })),
      })),
      delete: vi.fn(() => ({ where: mockDeleteWhere })),
      transaction: mockTransaction,
    },
  };
});

vi.mock('@CeolX/db/schema/social', () => ({
  posts: {
    id: 'id',
    createdBy: 'created_by',
    deletedAt: 'deleted_at',
    createdAt: 'created_at',
    likeCount: 'like_count',
  },
  postLikes: { id: 'id', postId: 'post_id', userId: 'user_id' },
  follows: { followerId: 'follower_id', followeeId: 'followee_id' },
}));
vi.mock('@CeolX/db/schema/auth', () => ({
  user: { id: 'id', name: 'name', image: 'image' },
}));
vi.mock('@CeolX/db/schema/users', () => ({
  artistProfiles: {
    userId: 'user_id',
    stageName: 'stage_name',
    profileImageUrl: 'profile_image_url',
  },
  venueProfiles: {
    userId: 'user_id',
    venueName: 'venue_name',
    profileImageUrl: 'profile_image_url',
  },
}));

import { t } from '../index';
import { postsRouter } from '../routers/posts';

// ─── Callers ─────────────────────────────────────────────────────────────────

const createCaller = t.createCallerFactory(postsRouter);

function anonCaller() {
  return createCaller({ session: null } as never);
}

function authedCaller(userId = 'user-1', role: UserRole = 'artist' as UserRole) {
  return createCaller({
    session: {
      user: { id: userId, currentRole: role },
    },
    userId,
    currentRole: role,
  } as never);
}

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  // Default: select chain resolves to empty array (for hydrateAuthors lookups).
  mockSelectChain.mockResolvedValue([]);
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('posts.create', () => {
  it('rejects spectators (creatorProcedure)', async () => {
    const caller = authedCaller('user-1', 'spectator' as UserRole);
    await expect(
      caller.create({ caption: 'Hello world', mediaType: 'text' })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('creates a text post', async () => {
    mockInsertReturning.mockResolvedValueOnce([
      {
        id: 'post-1',
        createdBy: 'user-1',
        caption: 'Hello world',
        mediaType: 'text',
        mediaUrl: null,
        likeCount: 0,
        deletedAt: null,
        createdAt: new Date('2026-04-17T00:00:00Z'),
        updatedAt: new Date('2026-04-17T00:00:00Z'),
      },
    ]);
    const caller = authedCaller('user-1', 'artist' as UserRole);
    const result = await caller.create({ caption: 'Hello world', mediaType: 'text' });
    expect(result).toMatchObject({
      id: 'post-1',
      caption: 'Hello world',
      mediaType: 'text',
      mediaUrl: null,
      likedByMe: false,
    });
    expect(result.author.id).toBe('user-1');
  });

  it('creates an image post with mediaUrl', async () => {
    mockInsertReturning.mockResolvedValueOnce([
      {
        id: 'post-2',
        createdBy: 'user-1',
        caption: 'Check this out',
        mediaType: 'image',
        mediaUrl: 'https://cdn.example/posts/x.jpg',
        likeCount: 0,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    const caller = authedCaller('user-1', 'venue' as UserRole);
    const result = await caller.create({
      caption: 'Check this out',
      mediaType: 'image',
      mediaUrl: 'https://cdn.example/posts/x.jpg',
    });
    expect(result.mediaUrl).toBe('https://cdn.example/posts/x.jpg');
    expect(result.mediaType).toBe('image');
  });

  it('rejects text post with a mediaUrl (schema refinement)', async () => {
    const caller = authedCaller('user-1', 'artist' as UserRole);
    await expect(
      caller.create({
        caption: 'oops',
        mediaType: 'text',
        mediaUrl: 'https://cdn.example/x.jpg',
      })
    ).rejects.toThrow();
  });

  it('rejects image post without mediaUrl', async () => {
    const caller = authedCaller('user-1', 'artist' as UserRole);
    await expect(caller.create({ caption: 'oops', mediaType: 'image' })).rejects.toThrow();
  });
});

describe('posts.update', () => {
  it("rejects edits to someone else's post", async () => {
    mockPostsFindFirst.mockResolvedValueOnce({
      id: 'post-1',
      createdBy: 'user-other',
      deletedAt: null,
    });
    const caller = authedCaller('user-1', 'artist' as UserRole);
    await expect(
      caller.update({ id: '550e8400-e29b-41d4-a716-446655440001', caption: 'hacked' })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('returns 404 for deleted posts', async () => {
    mockPostsFindFirst.mockResolvedValueOnce({
      id: 'post-1',
      createdBy: 'user-1',
      deletedAt: new Date(),
    });
    const caller = authedCaller('user-1', 'artist' as UserRole);
    await expect(
      caller.update({ id: '550e8400-e29b-41d4-a716-446655440001', caption: 'x' })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('updates caption only on own post', async () => {
    mockPostsFindFirst.mockResolvedValueOnce({
      id: 'post-1',
      createdBy: 'user-1',
      deletedAt: null,
    });
    mockUpdateReturning.mockResolvedValueOnce([
      {
        id: 'post-1',
        createdBy: 'user-1',
        caption: 'new caption',
        mediaType: 'text',
        mediaUrl: null,
        likeCount: 0,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    const caller = authedCaller('user-1', 'artist' as UserRole);
    const result = await caller.update({
      id: '550e8400-e29b-41d4-a716-446655440001',
      caption: 'new caption',
    });
    expect(result.caption).toBe('new caption');
  });

  it('rejects update with no fields (schema refinement)', async () => {
    const caller = authedCaller('user-1', 'artist' as UserRole);
    await expect(caller.update({ id: '550e8400-e29b-41d4-a716-446655440001' })).rejects.toThrow();
  });
});

describe('posts.delete', () => {
  it('soft-deletes own post and surfaces media identifiers', async () => {
    mockPostsFindFirst.mockResolvedValueOnce({
      id: 'post-1',
      createdBy: 'user-1',
      deletedAt: null,
      mediaUrl: 'https://cdn.example/posts/u/x.jpg',
      muxAssetId: null,
    });
    const caller = authedCaller('user-1', 'artist' as UserRole);
    const result = await caller.delete({ id: '550e8400-e29b-41d4-a716-446655440001' });
    expect(result).toEqual({
      success: true,
      mediaUrl: 'https://cdn.example/posts/u/x.jpg',
      muxAssetId: null,
    });
    expect(mockUpdateWhereNoReturn).toHaveBeenCalled();
  });

  it("blocks deletion of other users' posts", async () => {
    mockPostsFindFirst.mockResolvedValueOnce({
      id: 'post-1',
      createdBy: 'user-other',
      deletedAt: null,
    });
    const caller = authedCaller('user-1', 'artist' as UserRole);
    await expect(
      caller.delete({ id: '550e8400-e29b-41d4-a716-446655440001' })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('posts.byId', () => {
  it('is public (works without auth)', async () => {
    mockPostsFindFirst.mockResolvedValueOnce({
      id: 'post-1',
      createdBy: 'user-1',
      caption: 'hi',
      mediaType: 'text',
      mediaUrl: null,
      likeCount: 2,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const result = await anonCaller().byId({ id: '550e8400-e29b-41d4-a716-446655440001' });
    expect(result.id).toBe('post-1');
    expect(result.likedByMe).toBe(false);
  });

  it('returns 404 when deleted', async () => {
    mockPostsFindFirst.mockResolvedValueOnce({
      id: 'post-1',
      createdBy: 'user-1',
      deletedAt: new Date(),
    });
    await expect(
      anonCaller().byId({ id: '550e8400-e29b-41d4-a716-446655440001' })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('posts.toggleLike', () => {
  it('likes a post on first call', async () => {
    mockPostsFindFirst.mockResolvedValueOnce({
      id: 'post-1',
      createdBy: 'user-other',
      deletedAt: null,
    });
    mockPostLikesFindFirst.mockResolvedValueOnce(null); // not yet liked
    mockUpdateReturning.mockResolvedValueOnce([{ likeCount: 1 }]);

    const caller = authedCaller('user-1', 'spectator' as UserRole);
    const result = await caller.toggleLike({ postId: '550e8400-e29b-41d4-a716-446655440001' });
    expect(result).toEqual({ liked: true, likeCount: 1 });
  });

  it('unlikes on second call', async () => {
    mockPostsFindFirst.mockResolvedValueOnce({
      id: 'post-1',
      createdBy: 'user-other',
      deletedAt: null,
    });
    mockPostLikesFindFirst.mockResolvedValueOnce({
      id: 'like-1',
      postId: 'post-1',
      userId: 'user-1',
    });
    mockUpdateReturning.mockResolvedValueOnce([{ likeCount: 0 }]);

    const caller = authedCaller('user-1', 'spectator' as UserRole);
    const result = await caller.toggleLike({ postId: '550e8400-e29b-41d4-a716-446655440001' });
    expect(result).toEqual({ liked: false, likeCount: 0 });
  });

  it('returns 404 for missing posts', async () => {
    mockPostsFindFirst.mockResolvedValueOnce(null);
    const caller = authedCaller('user-1', 'spectator' as UserRole);
    await expect(
      caller.toggleLike({ postId: '550e8400-e29b-41d4-a716-446655440001' })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('posts.byUser', () => {
  it('is public and returns posts with hydration', async () => {
    // Two select chain resolutions: the paginated rows, then the count row.
    mockSelectChain
      .mockResolvedValueOnce([
        {
          id: 'post-1',
          createdBy: 'user-1',
          caption: 'a',
          mediaType: 'text',
          mediaUrl: null,
          likeCount: 0,
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ])
      .mockResolvedValueOnce([{ count: 1 }])
      // hydrateAuthors: user + artist + venue
      .mockResolvedValueOnce([{ id: 'user-1', name: 'Test User', image: null }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await anonCaller().byUser({ userId: 'user-1' });
    expect(result.totalCount).toBe(1);
    expect(result.posts).toHaveLength(1);
    expect(result.posts[0]?.author.displayName).toBe('Test User');
  });
});

describe('posts.feed', () => {
  it('requires authentication', async () => {
    await expect(anonCaller().feed({ limit: 20, offset: 0 })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('returns own + followed posts', async () => {
    // 1st select: follows -> list of followees
    // 2nd: posts page
    // 3rd: count
    // Then hydration queries (user, artist, venue)
    mockSelectChain
      .mockResolvedValueOnce([{ followeeId: 'user-2' }]) // follows
      .mockResolvedValueOnce([
        {
          id: 'post-1',
          createdBy: 'user-1',
          caption: 'own post',
          mediaType: 'text',
          mediaUrl: null,
          likeCount: 0,
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]) // paginated posts
      .mockResolvedValueOnce([{ count: 1 }]) // count
      .mockResolvedValueOnce([{ id: 'user-1', name: 'Me', image: null }]) // users hydration
      .mockResolvedValueOnce([]) // artists
      .mockResolvedValueOnce([]) // venues
      .mockResolvedValueOnce([]); // likedRows

    const caller = authedCaller('user-1', 'artist' as UserRole);
    const result = await caller.feed({ limit: 20, offset: 0 });
    expect(result.posts).toHaveLength(1);
    expect(result.totalCount).toBe(1);
  });
});
