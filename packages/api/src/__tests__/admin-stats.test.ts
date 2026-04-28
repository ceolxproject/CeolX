import { describe, expect, it } from 'vitest';

import {
  VENUE_MONTHLY_PRICE_EUR,
  computeMrrEur,
  computeTrend,
  shapeEventStats,
  shapeUserStats,
  shapeSubscriptionStats,
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
  it('aggregates total, persona breakdown, and trend', () => {
    const result = shapeUserStats({
      byRole: [
        { role: 'spectator', count: 180 },
        { role: 'artist', count: 45 },
        { role: 'venue', count: 22 },
      ],
      newLast7Days: 12,
      newLast30Days: 34,
      newPrev30Days: 28,
    });

    expect(result).toEqual({
      total: 247,
      byPersona: { spectator: 180, artist: 45, venue: 22 },
      newLast7Days: 12,
      newLast30Days: 34,
      trend: 'up',
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
      newPrev30Days: 0,
    });
    expect(result.byPersona).toEqual({ spectator: 1, artist: 0, venue: 0 });
    expect(result.total).toBe(2);
  });
});

describe('shapeEventStats', () => {
  it('aggregates total, status breakdown, and trend', () => {
    const result = shapeEventStats({
      byStatus: [
        { status: 'active', count: 45 },
        { status: 'pending_review', count: 8 },
        { status: 'rejected', count: 2 },
        { status: 'archived', count: 34 },
      ],
      newLast7Days: 5,
      newLast30Days: 18,
      newPrev30Days: 20,
    });

    expect(result).toEqual({
      total: 89,
      byStatus: { active: 45, pending_review: 8, rejected: 2, archived: 34, draft: 0, removed: 0 },
      newLast7Days: 5,
      newLast30Days: 18,
      trend: 'down',
    });
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
      trend: 'flat',
    });
  });
});
