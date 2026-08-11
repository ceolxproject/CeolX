import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { UserRole } from '@CeolX/shared';

// ─── Hoisted mocks ──────────────────────────────────────────────────────────

const {
  mockPostsFindFirst,
  mockPostLikesFindFirst,
  mockEventsFindFirst,
  mockInsertValues,
  mockInsertReturning,
  mockUpdateReturning,
  mockUpdateWhereNoReturn,
  mockDeleteWhere,
  mockDeleteReturning,
  mockSelectChain,
  mockTransaction,
  mockRetrieveUploadStatus,
} = vi.hoisted(() => {
  const mockPostsFindFirst = vi.fn();
  const mockPostLikesFindFirst = vi.fn();
  const mockEventsFindFirst = vi.fn();
  const mockInsertReturning = vi.fn();
  // Mux asset lookup performed by posts.create for video posts.
  const mockRetrieveUploadStatus = vi.fn();
  // Captures the object passed to db.insert(posts).values(...) so tests can
  // assert which columns actually get persisted (regression guard for the
  // dropped-muxUploadId bug).
  const mockInsertValues = vi.fn(() => ({ returning: mockInsertReturning }));
  const mockUpdateReturning = vi.fn();
  const mockUpdateWhereNoReturn = vi.fn(() => Promise.resolve());
  // toggleLike's unlike path reads back the deleted rows to tell a real unlike
  // apart from a lost race, so `where` must return a `.returning()`-able object.
  const mockDeleteReturning = vi.fn();
  const mockDeleteWhere = vi.fn(() => ({ returning: mockDeleteReturning }));
  const mockSelectChain = vi.fn();
  const mockInsertValuesNoReturn = vi.fn(() => Promise.resolve());

  const mockTransaction = vi.fn((cb: (tx: unknown) => Promise<unknown>) => {
    // Tx gets the same api shape as db
    return cb({
      query: {
        postLikes: { findFirst: mockPostLikesFindFirst },
      },
      // The unlike path re-reads like_count inside the transaction when its
      // DELETE removed nothing, so tx needs a select chain too.
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => mockSelectChain() as Promise<unknown>),
        })),
      })),
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
    mockEventsFindFirst,
    mockInsertValues,
    mockInsertReturning,
    mockUpdateReturning,
    mockUpdateWhereNoReturn,
    mockDeleteWhere,
    mockDeleteReturning,
    mockSelectChain,
    mockTransaction,
    mockRetrieveUploadStatus,
  };
});

vi.mock('@CeolX/db', () => {
  const chain = {
    from: vi.fn(() => chain),
    leftJoin: vi.fn(() => chain),
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
        events: { findFirst: mockEventsFindFirst },
      },
      select: vi.fn(() => chain),
      insert: vi.fn(() => ({
        values: mockInsertValues,
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
    eventId: 'event_id',
    deletedAt: 'deleted_at',
    createdAt: 'created_at',
    likeCount: 'like_count',
  },
  postLikes: { id: 'id', postId: 'post_id', userId: 'user_id', createdAt: 'created_at' },
  follows: { followerId: 'follower_id', followeeId: 'followee_id' },
}));
vi.mock('../services/mux', () => ({
  retrieveUploadStatus: mockRetrieveUploadStatus,
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
  // Default: the unlike delete actually removed the row.
  mockDeleteReturning.mockResolvedValue([{ id: 'like-1' }]);
  // Default: Mux asset still transcoding when the post is created.
  mockRetrieveUploadStatus.mockResolvedValue({
    status: 'pending',
    playbackId: null,
    assetId: null,
  });
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

  it('persists muxUploadId and pending status when the asset is still transcoding', async () => {
    // Regression: the create handler used to drop muxUploadId, leaving the
    // row with mux_upload_id = NULL so the video.asset.ready webhook
    // (UPDATE ... WHERE mux_upload_id = $1) could never match it. Here the
    // asset isn't ready yet (default mock), so the webhook is the backstop.
    mockInsertReturning.mockResolvedValueOnce([
      {
        id: 'post-vid',
        createdBy: 'user-1',
        caption: 'My teddy bear',
        mediaType: 'video',
        mediaUrl: null,
        muxUploadId: 'upl_abc',
        muxStatus: 'pending',
        likeCount: 0,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    const caller = authedCaller('user-1', 'artist' as UserRole);
    await caller.create({
      caption: 'My teddy bear',
      mediaType: 'video',
      muxUploadId: 'upl_abc',
    });
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        muxUploadId: 'upl_abc',
        muxStatus: 'pending',
        muxPlaybackId: null,
        mediaUrl: null,
      })
    );
  });

  it('seeds asset/playback ids and hls url when Mux is already ready at create time', async () => {
    // The client polls Mux until ready BEFORE creating the post, so the
    // webhook usually fires before this row exists. Resolving the asset
    // state at create time closes that race — the post lands 'ready'
    // without depending on the webhook.
    mockRetrieveUploadStatus.mockResolvedValueOnce({
      status: 'ready',
      playbackId: 'pb_123',
      assetId: 'asset_xyz',
    });
    mockInsertReturning.mockResolvedValueOnce([
      {
        id: 'post-vid',
        createdBy: 'user-1',
        caption: 'My DJ band',
        mediaType: 'video',
        mediaUrl: 'https://stream.mux.com/pb_123.m3u8',
        muxUploadId: 'upl_abc',
        muxAssetId: 'asset_xyz',
        muxPlaybackId: 'pb_123',
        muxStatus: 'ready',
        likeCount: 0,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    const caller = authedCaller('user-1', 'artist' as UserRole);
    await caller.create({
      caption: 'My DJ band',
      mediaType: 'video',
      muxUploadId: 'upl_abc',
    });
    expect(mockRetrieveUploadStatus).toHaveBeenCalledWith('upl_abc');
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        muxUploadId: 'upl_abc',
        muxAssetId: 'asset_xyz',
        muxPlaybackId: 'pb_123',
        muxStatus: 'ready',
        mediaUrl: 'https://stream.mux.com/pb_123.m3u8',
      })
    );
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

  it('does not decrement when a concurrent unlike already removed the row', async () => {
    mockPostsFindFirst.mockResolvedValueOnce({
      id: 'post-1',
      createdBy: 'user-other',
      deletedAt: null,
      likeCount: 3,
    });
    mockPostLikesFindFirst.mockResolvedValueOnce({
      id: 'like-1',
      postId: 'post-1',
      userId: 'user-1',
    });
    mockDeleteReturning.mockResolvedValueOnce([]); // lost the race
    // The winner already decremented, so the re-read sees 2 — not the 3 that was
    // loaded before the transaction opened.
    mockSelectChain.mockResolvedValueOnce([{ likeCount: 2 }]);

    const caller = authedCaller('user-1', 'spectator' as UserRole);
    const result = await caller.toggleLike({ postId: '550e8400-e29b-41d4-a716-446655440001' });

    expect(result).toEqual({ liked: false, likeCount: 2 });
    expect(mockUpdateReturning).not.toHaveBeenCalled();
  });
});

describe('posts.likers', () => {
  const POST_ID = '550e8400-e29b-41d4-a716-446655440001';

  // The chain mock is shared, so every db.select() pulls the next queued value.
  // On page zero: like rows → count → visibility guard → hydrateAuthors'
  // users/artists/venues. hydrateAuthors runs three selects, not four: no
  // viewerId is passed, so the `follows` lookup is skipped.
  function queuePageZero(userIds: string[], total: number, visible = true) {
    mockSelectChain
      .mockResolvedValueOnce(userIds.map((userId) => ({ userId })))
      .mockResolvedValueOnce([{ count: total }])
      .mockResolvedValueOnce(visible ? [{ id: 'post-1' }] : []);
    if (!visible) return;
    mockSelectChain
      .mockResolvedValueOnce(userIds.map((id) => ({ id, name: `User ${id}`, image: null })))
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
  }

  it('requires a session — spectators have no public profile to expose', async () => {
    await expect(
      anonCaller().likers({ postId: POST_ID, limit: 20, offset: 0 })
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('returns hydrated likers newest-first', async () => {
    queuePageZero(['user-a', 'user-b'], 2);

    const result = await authedCaller().likers({ postId: POST_ID, limit: 20, offset: 0 });

    expect(result.totalCount).toBe(2);
    expect(result.hasNextPage).toBe(false);
    expect(result.likers.map((l) => l.id)).toEqual(['user-a', 'user-b']);
    expect(result.likers[0]?.displayName).toBe('User user-a');
    // isFollowedByMe is deliberately not returned — nothing renders it.
    expect(result.likers[0]).not.toHaveProperty('isFollowedByMe');
  });

  it('flags a next page when the extra row comes back', async () => {
    queuePageZero(['user-a', 'user-b'], 2);

    const result = await authedCaller().likers({ postId: POST_ID, limit: 1, offset: 0 });

    expect(result.hasNextPage).toBe(true);
    expect(result.likers).toHaveLength(1);
  });

  it('skips the count past the first page', async () => {
    // No count select is queued: offset > 0 must not run one.
    mockSelectChain
      .mockResolvedValueOnce([{ userId: 'user-c' }])
      .mockResolvedValueOnce([{ id: 'post-1' }])
      .mockResolvedValueOnce([{ id: 'user-c', name: 'User user-c', image: null }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await authedCaller().likers({ postId: POST_ID, limit: 20, offset: 20 });

    expect(result.totalCount).toBeNull();
    expect(result.likers.map((l) => l.id)).toEqual(['user-c']);
  });

  it('returns 404 when the post fails the visibility guard', async () => {
    // Guard select comes back empty — soft-deleted, or a promo post whose event
    // has ended. Nothing past the guard runs, so nothing further is queued.
    queuePageZero([], 0, false);

    await expect(
      authedCaller().likers({ postId: POST_ID, limit: 20, offset: 0 })
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

  it('passes the eventEnded flag through to the owner (Ended-badge data)', async () => {
    // The owner viewing their own profile receives promos for events that have
    // already ended, flagged eventEnded — the read-time owner/expiry filtering
    // itself is SQL and verified against a live DB, not these mocks.
    mockSelectChain
      .mockResolvedValueOnce([
        {
          id: 'promo-1',
          createdBy: 'user-1',
          caption: 'Past gig',
          mediaType: 'image',
          mediaUrl: 'https://cdn/x.jpg',
          eventId: 'evt-1',
          eventEnded: true,
          likeCount: 3,
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ])
      .mockResolvedValueOnce([{ count: 1 }])
      .mockResolvedValueOnce([{ id: 'user-1', name: 'Test User', image: null }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await authedCaller('user-1').byUser({ userId: 'user-1' });
    expect(result.posts[0]?.eventEnded).toBe(true);
    expect(result.posts[0]?.eventId).toBe('evt-1');
  });
});

describe('posts.feed', () => {
  it('is public — a guest (no session) reads the feed with likedByMe=false', async () => {
    // Guests ("Skip sign-in") have no session. The feed must stay readable for
    // them (posts are public), skipping the per-viewer follow/liked lookups and
    // defaulting likedByMe / isFollowedByMe to false. (Asana 1216227543475896)
    mockSelectChain
      .mockResolvedValueOnce([
        {
          id: 'post-1',
          createdBy: 'user-2',
          caption: 'a public post',
          mediaType: 'text',
          mediaUrl: null,
          likeCount: 3,
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          eventLat: null,
          eventLng: null,
        },
      ]) // ranked candidates
      .mockResolvedValueOnce([{ id: 'user-2', name: 'Stranger', image: null }]) // users
      .mockResolvedValueOnce([]) // artists
      .mockResolvedValueOnce([]); // venues — followedRows + likedRows are skipped for a guest

    const result = await anonCaller().feed({ limit: 20, offset: 0 });
    expect(result.posts).toHaveLength(1);
    expect(result.posts[0]?.likedByMe).toBe(false);
    expect(result.posts[0]?.author.isFollowedByMe).toBe(false);
  });

  it('returns all non-deleted posts globally', async () => {
    // Browse (no query) is the ranked path. Select order: the viewer's full
    // followed set resolves first (its .then() is invoked at expression
    // evaluation), then the candidate set, then hydration (users, artists,
    // venues, followedRows) and likedRows.
    mockSelectChain
      .mockResolvedValueOnce([]) // viewer's followed set (ranking)
      .mockResolvedValueOnce([
        {
          id: 'post-1',
          createdBy: 'user-2',
          caption: 'a post from someone not followed',
          mediaType: 'text',
          mediaUrl: null,
          likeCount: 0,
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          eventLat: null,
          eventLng: null,
        },
      ]) // ranked candidates
      .mockResolvedValueOnce([{ id: 'user-2', name: 'Stranger', image: null }]) // users hydration
      .mockResolvedValueOnce([]) // artists
      .mockResolvedValueOnce([]) // venues
      .mockResolvedValueOnce([]) // followedRows (hydration, page-scoped)
      .mockResolvedValueOnce([]); // likedRows

    const caller = authedCaller('user-1', 'artist' as UserRole);
    const result = await caller.feed({ limit: 20, offset: 0 });
    expect(result.posts).toHaveLength(1);
    expect(result.posts[0]?.createdBy).toBe('user-2');
    expect(result.totalCount).toBe(1);
  });

  it('annotates author.isFollowedByMe=true when the viewer follows the author', async () => {
    // hydrateAuthors dequeues, in Promise.all order: users, artists, venues,
    // followedRows — then the feed handler runs likedRows. A non-empty
    // followedRows for user-2 must surface as isFollowedByMe on the author.
    mockSelectChain
      .mockResolvedValueOnce([{ followeeId: 'user-2' }]) // viewer's followed set (ranking)
      .mockResolvedValueOnce([
        {
          id: 'post-1',
          createdBy: 'user-2',
          caption: 'followed author post',
          mediaType: 'text',
          mediaUrl: null,
          likeCount: 0,
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          eventLat: null,
          eventLng: null,
        },
      ]) // ranked candidates
      .mockResolvedValueOnce([{ id: 'user-2', name: 'Stranger', image: null }]) // users
      .mockResolvedValueOnce([]) // artists
      .mockResolvedValueOnce([]) // venues
      .mockResolvedValueOnce([{ followeeId: 'user-2' }]) // followedRows — viewer follows user-2
      .mockResolvedValueOnce([]); // likedRows

    const caller = authedCaller('user-1', 'artist' as UserRole);
    const result = await caller.feed({ limit: 20, offset: 0 });
    expect(result.posts[0]?.author.isFollowedByMe).toBe(true);
  });

  it("reports isFollowedByMe=false for the viewer's own authored posts", async () => {
    // A self-follow row never exists, so the followed lookup returns nothing for
    // the viewer's own author id → false (the documented "never follows self").
    mockSelectChain
      .mockResolvedValueOnce([]) // viewer's followed set (ranking)
      .mockResolvedValueOnce([
        {
          id: 'post-1',
          createdBy: 'user-1',
          caption: 'my own post',
          mediaType: 'text',
          mediaUrl: null,
          likeCount: 0,
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          eventLat: null,
          eventLng: null,
        },
      ]) // ranked candidates
      .mockResolvedValueOnce([{ id: 'user-1', name: 'Me', image: null }]) // users
      .mockResolvedValueOnce([]) // artists
      .mockResolvedValueOnce([]) // venues
      .mockResolvedValueOnce([]) // followedRows — no self-follow row
      .mockResolvedValueOnce([]); // likedRows

    const caller = authedCaller('user-1', 'artist' as UserRole);
    const result = await caller.feed({ limit: 20, offset: 0 });
    expect(result.posts[0]?.author.isFollowedByMe).toBe(false);
  });

  it('ranks a followed author above a stranger posting at the same time', async () => {
    const createdAt = new Date();
    const makeRow = (id: string, createdBy: string) => ({
      id,
      createdBy,
      caption: 'same-age post',
      mediaType: 'text',
      mediaUrl: null,
      likeCount: 0,
      deletedAt: null,
      createdAt,
      updatedAt: createdAt,
      eventLat: null,
      eventLng: null,
    });
    mockSelectChain
      .mockResolvedValueOnce([{ followeeId: 'followed-author' }]) // viewer's followed set (ranking)
      .mockResolvedValueOnce([
        makeRow('post-stranger', 'stranger'),
        makeRow('post-followed', 'followed-author'),
      ]) // candidates, newest-first from SQL
      .mockResolvedValueOnce([
        { id: 'stranger', name: 'Stranger', image: null },
        { id: 'followed-author', name: 'Followed', image: null },
      ]) // users
      .mockResolvedValueOnce([]) // artists
      .mockResolvedValueOnce([]) // venues
      .mockResolvedValueOnce([{ followeeId: 'followed-author' }]) // followedRows (hydration)
      .mockResolvedValueOnce([]); // likedRows

    const caller = authedCaller('user-1', 'artist' as UserRole);
    const result = await caller.feed({ limit: 20, offset: 0 });
    expect(result.posts.map((p) => p.id)).toEqual(['post-followed', 'post-stranger']);
  });

  it('coerces string event coords from Drizzle and ranks a nearby post above a far one', async () => {
    // Drizzle returns numeric columns as strings — this pins the string→Number
    // bridge in the router; the ranker itself is covered in feed-ranking.test.ts.
    const createdAt = new Date();
    const makeRow = (id: string, eventLat: string, eventLng: string) => ({
      id,
      createdBy: 'user-2',
      caption: 'gig post',
      mediaType: 'text',
      mediaUrl: null,
      likeCount: 0,
      deletedAt: null,
      createdAt,
      updatedAt: createdAt,
      eventLat,
      eventLng,
    });
    mockSelectChain
      .mockResolvedValueOnce([
        makeRow('post-cork', '51.8985000', '-8.4756000'), // ~220 km from viewer
        makeRow('post-dublin', '53.3498000', '-6.2603000'),
      ]) // ranked candidates — guest viewer, so no follows queries
      .mockResolvedValueOnce([{ id: 'user-2', name: 'Stranger', image: null }]) // users
      .mockResolvedValueOnce([]) // artists
      .mockResolvedValueOnce([]); // venues

    const result = await anonCaller().feed({ limit: 20, offset: 0, lat: 53.3498, lng: -6.2603 });
    expect(result.posts.map((p) => p.id)).toEqual(['post-dublin', 'post-cork']);
  });

  it('filters by query — resolves matching author ids before the post page', async () => {
    // With a query present, the procedure first looks up author ids whose
    // display name matches (artist → venue → user), THEN runs the post page +
    // count, THEN hydrates. The mock resolves select chains in call order, so
    // this ordering is what proves the search branch ran.
    mockSelectChain
      .mockResolvedValueOnce([{ userId: 'user-2' }]) // artist name match
      .mockResolvedValueOnce([]) // venue name match
      .mockResolvedValueOnce([]) // user name match
      .mockResolvedValueOnce([
        {
          id: 'post-1',
          createdBy: 'user-2',
          caption: 'late night jazz set',
          mediaType: 'text',
          mediaUrl: null,
          likeCount: 0,
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]) // paginated posts
      .mockResolvedValueOnce([{ count: 1 }]) // count
      .mockResolvedValueOnce([{ id: 'user-2', name: 'Jazz Cat', image: null }]) // users hydration
      .mockResolvedValueOnce([{ userId: 'user-2', stageName: 'Jazz Cat', profileImageUrl: null }]) // artists
      .mockResolvedValueOnce([]) // venues
      .mockResolvedValueOnce([]); // likedRows

    const caller = authedCaller('user-1', 'artist' as UserRole);
    const result = await caller.feed({ limit: 20, offset: 0, query: 'jazz' });
    expect(result.posts).toHaveLength(1);
    expect(result.posts[0]?.author.displayName).toBe('Jazz Cat');
    expect(result.totalCount).toBe(1);
  });
});

describe('posts.byId — promo-post expiry', () => {
  const POST_ID = '11111111-1111-4111-8111-111111111111';
  const POST_ID_2 = '22222222-2222-4222-8222-222222222222';
  const promoPost = {
    id: POST_ID,
    createdBy: 'user-2',
    eventId: 'evt-1',
    caption: 'Live at the Cobblestone',
    mediaType: 'text',
    mediaUrl: null,
    likeCount: 0,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('404s when the linked event has already passed', async () => {
    mockPostsFindFirst.mockResolvedValueOnce(promoPost);
    mockEventsFindFirst.mockResolvedValueOnce({
      status: 'active',
      dateStart: new Date(Date.now() - 86_400_000),
      dateEnd: null,
    });
    const caller = authedCaller('user-1');
    await expect(caller.byId({ id: POST_ID })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('returns the post when the linked event is still upcoming', async () => {
    mockPostsFindFirst.mockResolvedValueOnce(promoPost);
    mockEventsFindFirst.mockResolvedValueOnce({
      status: 'active',
      dateStart: new Date(Date.now() + 86_400_000),
      dateEnd: null,
    });
    const caller = authedCaller('user-1');
    const result = await caller.byId({ id: POST_ID });
    expect(result.id).toBe(POST_ID);
    expect(mockEventsFindFirst).toHaveBeenCalledTimes(1);
  });

  it('404s when the linked event is not active (e.g. removed), even if upcoming', async () => {
    mockPostsFindFirst.mockResolvedValueOnce(promoPost);
    mockEventsFindFirst.mockResolvedValueOnce({
      status: 'removed',
      dateStart: new Date(Date.now() + 86_400_000),
      dateEnd: null,
    });
    const caller = authedCaller('user-1');
    await expect(caller.byId({ id: POST_ID })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('does not look up an event for a non-promo post (eventId null)', async () => {
    mockPostsFindFirst.mockResolvedValueOnce({ ...promoPost, id: POST_ID_2, eventId: null });
    const caller = authedCaller('user-1');
    const result = await caller.byId({ id: POST_ID_2 });
    expect(result.id).toBe(POST_ID_2);
    expect(mockEventsFindFirst).not.toHaveBeenCalled();
  });
});

describe('posts.remove / update — promo posts are event-managed', () => {
  const PROMO_ID = '33333333-3333-4333-8333-333333333333';
  const promo = {
    id: PROMO_ID,
    createdBy: 'user-1',
    eventId: 'evt-1',
    caption: 'Live at the Cobblestone',
    mediaType: 'text',
    mediaUrl: null,
    likeCount: 0,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('rejects removing a promo post — managed via its event (FORBIDDEN, prevents resurrection)', async () => {
    mockPostsFindFirst.mockResolvedValueOnce(promo);
    const caller = authedCaller('user-1');
    await expect(caller.delete({ id: PROMO_ID })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('rejects editing a promo post directly (FORBIDDEN)', async () => {
    mockPostsFindFirst.mockResolvedValueOnce(promo);
    const caller = authedCaller('user-1');
    await expect(caller.update({ id: PROMO_ID, caption: 'edited' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});
