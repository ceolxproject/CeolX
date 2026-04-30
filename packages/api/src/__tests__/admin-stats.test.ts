import { describe, expect, it } from 'vitest';

import {
  VENUE_MONTHLY_PRICE_EUR,
  buildCacheMeta,
  computeMrrEur,
  computeTrend,
  shapeBookingStats,
  shapeEngagementStats,
  shapeEventStats,
  shapeModerationStats,
  shapeSessionStats,
  shapeSubscriptionStats,
  shapeTopCategories,
  shapeUserStats,
} from '../lib/admin-stats';

describe('computeTrend', () => {
  it('returns "up" when current strictly exceeds previous', () => {
    expect(computeTrend(10, 5)).toBe('up');
  });

  it('returns "down" when current is strictly below previous', () => {
    expect(computeTrend(2, 5)).toBe('down');
  });

  it('returns "flat" when current equals previous', () => {
    expect(computeTrend(7, 7)).toBe('flat');
  });

  it('returns "flat" when both are zero (avoids divide-by-zero)', () => {
    expect(computeTrend(0, 0)).toBe('flat');
  });

  it('returns "up" when previous is zero and current is positive', () => {
    expect(computeTrend(3, 0)).toBe('up');
  });
});

describe('computeMrrEur', () => {
  it('multiplies activeVenues by the venue subscription price', () => {
    expect(computeMrrEur(22)).toBe(22 * VENUE_MONTHLY_PRICE_EUR);
  });

  it('returns 0 for zero active venues', () => {
    expect(computeMrrEur(0)).toBe(0);
  });

  it('refuses negative inputs (defensive — clamps to 0)', () => {
    expect(computeMrrEur(-3)).toBe(0);
  });
});

describe('shapeUserStats', () => {
  it('aggregates total, persona breakdown, and both 7d and 30d trends', () => {
    const result = shapeUserStats({
      byRole: [
        { role: 'spectator', count: 180 },
        { role: 'artist', count: 45 },
        { role: 'venue', count: 22 },
      ],
      newLast7Days: 12,
      newLast30Days: 34,
      newPrev7Days: 8,
      newPrev30Days: 28,
    });

    expect(result).toEqual({
      total: 247,
      byPersona: { spectator: 180, artist: 45, venue: 22 },
      newLast7Days: 12,
      newLast30Days: 34,
      trend7d: 'up',
      trend30d: 'up',
    });
  });

  it('omits unknown roles from byPersona but counts them in total', () => {
    const result = shapeUserStats({
      byRole: [
        { role: 'spectator', count: 1 },
        { role: 'admin', count: 1 },
      ],
      newLast7Days: 0,
      newLast30Days: 0,
      newPrev7Days: 0,
      newPrev30Days: 0,
    });
    expect(result.byPersona).toEqual({ spectator: 1, artist: 0, venue: 0 });
    expect(result.total).toBe(2);
    expect(result.trend7d).toBe('flat');
    expect(result.trend30d).toBe('flat');
  });
});

describe('shapeEventStats', () => {
  it('aggregates total, status breakdown, and both 7d and 30d trends', () => {
    const result = shapeEventStats({
      byStatus: [
        { status: 'active', count: 45 },
        { status: 'pending_review', count: 8 },
        { status: 'rejected', count: 2 },
        { status: 'archived', count: 34 },
      ],
      newLast7Days: 5,
      newLast30Days: 18,
      newPrev7Days: 7,
      newPrev30Days: 20,
    });

    expect(result).toEqual({
      total: 89,
      byStatus: { active: 45, pending_review: 8, rejected: 2, archived: 34, draft: 0, removed: 0 },
      newLast7Days: 5,
      newLast30Days: 18,
      trend7d: 'down',
      trend30d: 'down',
    });
  });
});

describe('shapeBookingStats', () => {
  it('zero-fills all booking statuses', () => {
    const result = shapeBookingStats({
      byStatus: [
        { status: 'pending', count: 8 },
        { status: 'accepted', count: 28 },
      ],
    });
    expect(result).toEqual({
      total: 36,
      byStatus: { pending: 8, accepted: 28, rejected: 0, cancelled: 0 },
    });
  });

  it('handles empty input', () => {
    const result = shapeBookingStats({ byStatus: [] });
    expect(result.total).toBe(0);
    expect(result.byStatus).toEqual({ pending: 0, accepted: 0, rejected: 0, cancelled: 0 });
  });

  it('ignores unknown statuses', () => {
    const result = shapeBookingStats({
      byStatus: [
        { status: 'accepted', count: 5 },
        { status: 'mystery', count: 99 },
      ],
    });
    expect(result.byStatus.accepted).toBe(5);
    expect(result.total).toBe(5);
  });
});

describe('shapeEngagementStats', () => {
  it('computes avg likes per post with one decimal of precision', () => {
    const result = shapeEngagementStats({
      totalFollows: 312,
      totalBookings: 41,
      totalPosts: 67,
      totalLikes: 281,
    });
    expect(result.totalFollows).toBe(312);
    expect(result.totalBookings).toBe(41);
    expect(result.totalPosts).toBe(67);
    expect(result.avgLikesPerPost).toBeCloseTo(4.2, 1);
  });

  it('returns 0 avg when there are no posts (no divide-by-zero)', () => {
    const result = shapeEngagementStats({
      totalFollows: 0,
      totalBookings: 0,
      totalPosts: 0,
      totalLikes: 0,
    });
    expect(result.avgLikesPerPost).toBe(0);
  });
});

describe('shapeModerationStats', () => {
  it('passes through pending, removed-7d, and removed-total counts', () => {
    expect(
      shapeModerationStats({ pendingReview: 0, removedLast7Days: 3, removedTotal: 11 })
    ).toEqual({
      pendingReview: 0,
      removedLast7Days: 3,
      removedTotal: 11,
    });
  });
});

describe('shapeSessionStats', () => {
  it('passes through 7d and 30d distinct active counts', () => {
    expect(shapeSessionStats({ activeLast7Days: 42, activeLast30Days: 110 })).toEqual({
      activeLast7Days: 42,
      activeLast30Days: 110,
    });
  });
});

describe('shapeTopCategories', () => {
  it('returns at most 5 categories sorted descending by count', () => {
    const result = shapeTopCategories([
      { category: 'trad', count: 25 },
      { category: 'folk', count: 14 },
      { category: 'sean-nós', count: 9 },
      { category: 'session', count: 6 },
      { category: 'rock', count: 4 },
      { category: 'jazz', count: 2 },
    ]);
    expect(result).toHaveLength(5);
    expect(result[0]).toEqual({ category: 'trad', count: 25 });
    expect(result[4]).toEqual({ category: 'rock', count: 4 });
  });

  it('handles fewer than 5 categories', () => {
    const result = shapeTopCategories([{ category: 'trad', count: 1 }]);
    expect(result).toHaveLength(1);
  });
});

describe('buildCacheMeta', () => {
  it('returns ISO timestamps for cachedAt and cacheExpiresAt offset by ttl', () => {
    const now = new Date('2026-04-30T14:30:00Z');
    const meta = buildCacheMeta(now, 5 * 60 * 1000);
    expect(meta.cachedAt).toBe('2026-04-30T14:30:00.000Z');
    expect(meta.cacheExpiresAt).toBe('2026-04-30T14:35:00.000Z');
  });
});

describe('shapeSubscriptionStats', () => {
  it('returns active venue count, MRR, new subs, and past-due count', () => {
    const result = shapeSubscriptionStats({
      activeVenues: 22,
      pastDueCount: 1,
      newLast30Days: 4,
      newPrev30Days: 4,
    });

    expect(result).toEqual({
      activeVenues: 22,
      mrr: 22 * VENUE_MONTHLY_PRICE_EUR,
      newLast30Days: 4,
      pastDueCount: 1,
      trend30d: 'flat',
    });
  });
});
