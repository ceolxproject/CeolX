import { describe, expect, it } from 'vitest';

import {
  computeDistanceScore,
  computeFeedScore,
  computeRecencyScore,
  computeSocialScore,
  rankFeedEvents,
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
    category: 'Traditional',
    coverImageUrl: null,
    isGigOpportunity: false,
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
