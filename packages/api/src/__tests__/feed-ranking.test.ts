import { describe, expect, it } from 'vitest';

import {
  computeDistanceScore,
  computeFeedScore,
  computePostFeedScore,
  computePostRecencyScore,
  computeRecencyScore,
  computeSocialScore,
  rankFeedEvents,
  rankFeedPosts,
  type RankablePost,
  type RawFeedEvent,
} from '../lib/feed-ranking';

// ─── computeRecencyScore ────────────────────────────────────────────────────

describe('computeRecencyScore', () => {
  it('returns ~1.0 for event created just now', () => {
    const score = computeRecencyScore(new Date());
    expect(score).toBeCloseTo(1.0, 1);
  });

  it('returns ~0.5 for event created 15 days ago', () => {
    const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
    const score = computeRecencyScore(fifteenDaysAgo);
    expect(score).toBeCloseTo(0.5, 1);
  });

  it('returns 0.0 for event created 30+ days ago', () => {
    const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    const score = computeRecencyScore(thirtyOneDaysAgo);
    expect(score).toBe(0);
  });

  it('clamps to 0 for very old events', () => {
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const score = computeRecencyScore(oneYearAgo);
    expect(score).toBe(0);
  });
});

// ─── computeDistanceScore ───────────────────────────────────────────────────

describe('computeDistanceScore', () => {
  it('returns 1.0 for distance 0', () => {
    expect(computeDistanceScore(0)).toBe(1.0);
  });

  it('returns 0.5 for distance 50km', () => {
    expect(computeDistanceScore(50)).toBeCloseTo(0.5, 1);
  });

  it('returns 0.0 for distance 100km', () => {
    expect(computeDistanceScore(100)).toBe(0);
  });

  it('clamps to 0 for distances > 100km', () => {
    expect(computeDistanceScore(200)).toBe(0);
  });
});

// ─── computeSocialScore ─────────────────────────────────────────────────────

describe('computeSocialScore', () => {
  it('returns 1.0 when following', () => {
    expect(computeSocialScore(true)).toBe(1.0);
  });

  it('returns 0.0 when not following', () => {
    expect(computeSocialScore(false)).toBe(0.0);
  });
});

// ─── computeFeedScore ───────────────────────────────────────────────────────

describe('computeFeedScore', () => {
  it('applies 40/40/20 weights correctly', () => {
    // All scores at 1.0 → 0.4 + 0.4 + 0.2 = 1.0
    expect(computeFeedScore(1.0, 1.0, 1.0)).toBeCloseTo(1.0, 5);
  });

  it('returns 0 when all component scores are 0', () => {
    expect(computeFeedScore(0, 0, 0)).toBe(0);
  });

  it('weights recency at 40%', () => {
    // Only recency = 1.0, others = 0
    expect(computeFeedScore(1.0, 0, 0)).toBeCloseTo(0.4, 5);
  });

  it('weights distance at 40%', () => {
    expect(computeFeedScore(0, 1.0, 0)).toBeCloseTo(0.4, 5);
  });

  it('weights social at 20%', () => {
    expect(computeFeedScore(0, 0, 1.0)).toBeCloseTo(0.2, 5);
  });
});

// ─── rankFeedEvents ─────────────────────────────────────────────────────────

function makeEvent(overrides: Partial<RawFeedEvent> = {}): RawFeedEvent {
  return {
    id: 'evt-1',
    title: 'Test Event',
    dateStart: new Date().toISOString(),
    lat: 53.3498, // Dublin
    lng: -6.2603,
    venueAddress: 'Temple Bar',
    category: 'Open Trad Sessions',
    coverImageUrl: null,
    createdAt: new Date().toISOString(),
    creatorName: 'Test Artist',
    creatorId: 'user-1',
    joinedCount: 0,
    ...overrides,
  };
}

describe('rankFeedEvents', () => {
  it('returns empty array for empty input', () => {
    const result = rankFeedEvents([], 53.3498, -6.2603, new Set());
    expect(result).toEqual([]);
  });

  it('sorts by score descending', () => {
    const recent = makeEvent({
      id: 'recent',
      createdAt: new Date().toISOString(),
      lat: 53.35,
      lng: -6.26,
    });
    const old = makeEvent({
      id: 'old',
      createdAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
      lat: 53.35,
      lng: -6.26,
    });

    const result = rankFeedEvents([old, recent], 53.35, -6.26, new Set());
    const first = result[0];
    const second = result[1];
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    if (!first || !second) return;
    expect(first.id).toBe('recent');
    expect(second.id).toBe('old');
  });

  it('boosts events from followed creators', () => {
    const followed = makeEvent({
      id: 'followed',
      creatorId: 'artist-1',
      lat: 53.35,
      lng: -6.26,
    });
    const notFollowed = makeEvent({
      id: 'not-followed',
      creatorId: 'artist-2',
      lat: 53.35,
      lng: -6.26,
    });

    const followedIds = new Set(['artist-1']);
    const result = rankFeedEvents([notFollowed, followed], 53.35, -6.26, followedIds);
    const first = result[0];
    expect(first).toBeDefined();
    if (!first) return;
    expect(first.id).toBe('followed');
  });

  it('includes distanceKm and score on each event', () => {
    const event = makeEvent({ lat: 53.35, lng: -6.26 });
    const result = rankFeedEvents([event], 53.35, -6.26, new Set());

    const first = result[0];
    expect(first).toBeDefined();
    if (!first) return;
    expect(first.distanceKm).toBeDefined();
    expect(typeof first.distanceKm).toBe('number');
    expect(first.score).toBeDefined();
    expect(first.score).toBeGreaterThanOrEqual(0);
    expect(first.score).toBeLessThanOrEqual(1);
  });

  it('breaks ties by createdAt descending (newer first)', () => {
    const now = Date.now();
    const eventA = makeEvent({
      id: 'a',
      createdAt: new Date(now - 1000).toISOString(),
      lat: 53.35,
      lng: -6.26,
    });
    const eventB = makeEvent({
      id: 'b',
      createdAt: new Date(now).toISOString(),
      lat: 53.35,
      lng: -6.26,
    });

    const result = rankFeedEvents([eventA, eventB], 53.35, -6.26, new Set());
    // Both should have very similar scores; eventB is newer so should come first
    const first = result[0];
    expect(first).toBeDefined();
    if (!first) return;
    expect(first.id).toBe('b');
  });
});

// ─── computePostRecencyScore ────────────────────────────────────────────────

describe('computePostRecencyScore', () => {
  it('returns ~1.0 for a post created just now', () => {
    expect(computePostRecencyScore(new Date())).toBeCloseTo(1.0, 1);
  });

  it('returns ~0.5 for a post created 7 days ago (14-day window)', () => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    expect(computePostRecencyScore(sevenDaysAgo)).toBeCloseTo(0.5, 1);
  });

  it('clamps to 0 for posts older than 14 days', () => {
    const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
    expect(computePostRecencyScore(fifteenDaysAgo)).toBe(0);
  });
});

// ─── computePostFeedScore ───────────────────────────────────────────────────

describe('computePostFeedScore', () => {
  it('applies 45/20/35 weights (recency/distance/social)', () => {
    expect(computePostFeedScore(1, 1, 1)).toBeCloseTo(1.0, 5);
    expect(computePostFeedScore(1, 0, 0)).toBeCloseTo(0.45, 5);
    expect(computePostFeedScore(0, 1, 0)).toBeCloseTo(0.2, 5);
    expect(computePostFeedScore(0, 0, 1)).toBeCloseTo(0.35, 5);
  });
});

// ─── rankFeedPosts ──────────────────────────────────────────────────────────

function makePost(
  overrides: Partial<RankablePost> & { id: string }
): RankablePost & { id: string } {
  return {
    createdAt: new Date().toISOString(),
    createdBy: 'user-1',
    eventLat: null,
    eventLng: null,
    ...overrides,
  };
}

describe('rankFeedPosts', () => {
  const dublin = { lat: 53.3498, lng: -6.2603 };

  it('returns empty array for empty input', () => {
    expect(rankFeedPosts([], dublin.lat, dublin.lng, new Set())).toEqual([]);
  });

  it('ranks followed authors above strangers at equal recency', () => {
    const followed = makePost({ id: 'followed', createdBy: 'artist-1' });
    const stranger = makePost({ id: 'stranger', createdBy: 'artist-2' });
    const result = rankFeedPosts(
      [stranger, followed],
      dublin.lat,
      dublin.lng,
      new Set(['artist-1'])
    );
    expect(result.map((p) => p.id)).toEqual(['followed', 'stranger']);
  });

  it('ranks a nearby event post above a far one at equal recency', () => {
    const near = makePost({ id: 'near', eventLat: dublin.lat, eventLng: dublin.lng });
    const far = makePost({ id: 'far', eventLat: 51.8985, eventLng: -8.4756 }); // Cork, ~220km
    const result = rankFeedPosts([far, near], dublin.lat, dublin.lng, new Set());
    expect(result.map((p) => p.id)).toEqual(['near', 'far']);
  });

  it('scores posts without an event neutral — above far posts, below nearby ones', () => {
    const near = makePost({ id: 'near', eventLat: dublin.lat, eventLng: dublin.lng });
    const noEvent = makePost({ id: 'no-event' });
    const far = makePost({ id: 'far', eventLat: 51.8985, eventLng: -8.4756 });
    const result = rankFeedPosts([far, noEvent, near], dublin.lat, dublin.lng, new Set());
    expect(result.map((p) => p.id)).toEqual(['near', 'no-event', 'far']);
  });

  it('falls back to recency + social when the viewer has no coordinates', () => {
    const oldFollowed = makePost({
      id: 'old-followed',
      createdBy: 'artist-1',
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    });
    const newStranger = makePost({ id: 'new-stranger', createdBy: 'artist-2' });
    const result = rankFeedPosts(
      [newStranger, oldFollowed],
      undefined,
      undefined,
      new Set(['artist-1'])
    );
    // 2-day-old followed post: 0.45*(1-2/14) + 0.35 ≈ 0.736 beats fresh stranger 0.45
    expect(result.map((p) => p.id)).toEqual(['old-followed', 'new-stranger']);
  });

  it('a fresh stranger post beats a stale (>14d) followed post', () => {
    const staleFollowed = makePost({
      id: 'stale-followed',
      createdBy: 'artist-1',
      createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    });
    const freshStranger = makePost({ id: 'fresh-stranger', createdBy: 'artist-2' });
    const result = rankFeedPosts(
      [staleFollowed, freshStranger],
      undefined,
      undefined,
      new Set(['artist-1'])
    );
    // stale followed: 0 + 0.35 = 0.35; fresh stranger: 0.45
    expect(result.map((p) => p.id)).toEqual(['fresh-stranger', 'stale-followed']);
  });

  it('breaks score ties by createdAt descending', () => {
    const now = Date.now();
    const older = makePost({ id: 'older', createdAt: new Date(now - 1000).toISOString() });
    const newer = makePost({ id: 'newer', createdAt: new Date(now).toISOString() });
    const result = rankFeedPosts([older, newer], undefined, undefined, new Set());
    expect(result[0]?.id).toBe('newer');
  });
});
