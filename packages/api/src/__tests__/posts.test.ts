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
    mockEventsFindFirst,
    mockInsertValues,
    mockInsertReturning,
    mockUpdateReturning,
    mockUpdateWhereNoReturn,
    mockDeleteWhere,
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
  postLikes: { id: 'id', postId: 'post_id', userId: 'user_id' },
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
    // them (posts are public), skipping the per-viewer liked lookup and
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
        },
      ]) // paginated posts
      .mockResolvedValueOnce([{ count: 1 }]) // count
      .mockResolvedValueOnce([{ id: 'user-2', name: 'Stranger', image: null }]) // users
      .mockResolvedValueOnce([]) // artists
      .mockResolvedValueOnce([]); // venues — followedRows + likedRows are skipped for a guest

    const result = await anonCaller().feed({ limit: 20, offset: 0 });
    expect(result.posts).toHaveLength(1);
    expect(result.posts[0]?.likedByMe).toBe(false);
    expect(result.posts[0]?.author.isFollowedByMe).toBe(false);
  });

  it('returns all non-deleted posts globally', async () => {
    // 1st select: posts page
    // 2nd: count
    // Then hydration queries (user, artist, venue)
    mockSelectChain
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
        },
      ]) // paginated posts
      .mockResolvedValueOnce([{ count: 1 }]) // count
      .mockResolvedValueOnce([{ id: 'user-2', name: 'Stranger', image: null }]) // users hydration
      .mockResolvedValueOnce([]) // artists
      .mockResolvedValueOnce([]) // venues
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
        },
      ]) // paginated posts
      .mockResolvedValueOnce([{ count: 1 }]) // count
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
        },
      ]) // paginated posts
      .mockResolvedValueOnce([{ count: 1 }]) // count
      .mockResolvedValueOnce([{ id: 'user-1', name: 'Me', image: null }]) // users
      .mockResolvedValueOnce([]) // artists
      .mockResolvedValueOnce([]) // venues
      .mockResolvedValueOnce([]) // followedRows — no self-follow row
      .mockResolvedValueOnce([]); // likedRows

    const caller = authedCaller('user-1', 'artist' as UserRole);
    const result = await caller.feed({ limit: 20, offset: 0 });
    expect(result.posts[0]?.author.isFollowedByMe).toBe(false);
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
