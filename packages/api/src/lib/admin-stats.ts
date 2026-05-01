/**
 * Pure helpers for the admin KPI stats procedure.
 *
 * The tRPC procedure (routers/admin/stats.ts) runs the raw aggregations against
 * Drizzle and feeds the rows into these shapers. Keeping the shaping pure makes
 * trend math + persona breakdown easy to unit test without mocking the database.
 *
 * MRR note: V1 has venue subscriptions only; artist subscriptions land in M3-T1.
 * Once they do, extend computeMrrEur with the artist price + activeArtists count.
 */

export const VENUE_MONTHLY_PRICE_EUR = 180;

export type Trend = 'up' | 'down' | 'flat';

export function computeTrend(current: number, previous: number): Trend {
  if (current > previous) return 'up';
  if (current < previous) return 'down';
  return 'flat';
}

export function computeMrrEur(activeVenues: number): number {
  if (activeVenues <= 0) return 0;
  return activeVenues * VENUE_MONTHLY_PRICE_EUR;
}

// ─── User stats ──────────────────────────────────────────────────────────────

export type UserStatsInput = {
  byRole: { role: string; count: number }[];
  newLast7Days: number;
  newLast30Days: number;
  newPrev7Days: number;
  newPrev30Days: number;
};

export type UserStats = {
  total: number;
  byPersona: { spectator: number; artist: number; venue: number };
  newLast7Days: number;
  newLast30Days: number;
  trend7d: Trend;
  trend30d: Trend;
};

export function shapeUserStats(input: UserStatsInput): UserStats {
  const total = input.byRole.reduce((sum, row) => sum + row.count, 0);
  const byPersona = { spectator: 0, artist: 0, venue: 0 };
  for (const row of input.byRole) {
    if (row.role === 'spectator' || row.role === 'artist' || row.role === 'venue') {
      byPersona[row.role] = row.count;
    }
  }
  return {
    total,
    byPersona,
    newLast7Days: input.newLast7Days,
    newLast30Days: input.newLast30Days,
    trend7d: computeTrend(input.newLast7Days, input.newPrev7Days),
    trend30d: computeTrend(input.newLast30Days, input.newPrev30Days),
  };
}

// ─── Event stats ─────────────────────────────────────────────────────────────

const EVENT_STATUSES = [
  'draft',
  'pending_review',
  'rejected',
  'active',
  'archived',
  'removed',
] as const;

type EventStatus = (typeof EVENT_STATUSES)[number];

export type EventStatsInput = {
  byStatus: { status: string; count: number }[];
  newLast7Days: number;
  newLast30Days: number;
  newPrev7Days: number;
  newPrev30Days: number;
};

export type EventStats = {
  total: number;
  byStatus: Record<EventStatus, number>;
  newLast7Days: number;
  newLast30Days: number;
  trend7d: Trend;
  trend30d: Trend;
};

export function shapeEventStats(input: EventStatsInput): EventStats {
  const total = input.byStatus.reduce((sum, row) => sum + row.count, 0);
  const byStatus = Object.fromEntries(EVENT_STATUSES.map((s) => [s, 0])) as Record<
    EventStatus,
    number
  >;
  for (const row of input.byStatus) {
    if ((EVENT_STATUSES as readonly string[]).includes(row.status)) {
      byStatus[row.status as EventStatus] = row.count;
    }
  }
  return {
    total,
    byStatus,
    newLast7Days: input.newLast7Days,
    newLast30Days: input.newLast30Days,
    trend7d: computeTrend(input.newLast7Days, input.newPrev7Days),
    trend30d: computeTrend(input.newLast30Days, input.newPrev30Days),
  };
}

// ─── Subscription stats ──────────────────────────────────────────────────────

export type SubscriptionStatsInput = {
  activeVenues: number;
  pastDueCount: number;
  newLast30Days: number;
  newPrev30Days: number;
};

export type SubscriptionStats = {
  activeVenues: number;
  mrr: number;
  newLast30Days: number;
  pastDueCount: number;
  trend30d: Trend;
};

export function shapeSubscriptionStats(input: SubscriptionStatsInput): SubscriptionStats {
  return {
    activeVenues: input.activeVenues,
    mrr: computeMrrEur(input.activeVenues),
    newLast30Days: input.newLast30Days,
    pastDueCount: input.pastDueCount,
    trend30d: computeTrend(input.newLast30Days, input.newPrev30Days),
  };
}

// ─── Booking stats (R17) ─────────────────────────────────────────────────────

const BOOKING_STATUSES = ['pending', 'accepted', 'rejected', 'cancelled'] as const;
type BookingStatus = (typeof BOOKING_STATUSES)[number];

export type BookingStatsInput = {
  byStatus: { status: string; count: number }[];
};

export type BookingStats = {
  total: number;
  byStatus: Record<BookingStatus, number>;
};

export function shapeBookingStats(input: BookingStatsInput): BookingStats {
  const byStatus = Object.fromEntries(BOOKING_STATUSES.map((s) => [s, 0])) as Record<
    BookingStatus,
    number
  >;
  let total = 0;
  for (const row of input.byStatus) {
    if ((BOOKING_STATUSES as readonly string[]).includes(row.status)) {
      byStatus[row.status as BookingStatus] = row.count;
      total += row.count;
    }
  }
  return { total, byStatus };
}

// ─── Engagement stats (extended with R19 avg-likes) ──────────────────────────

export type EngagementStatsInput = {
  totalFollows: number;
  totalBookings: number;
  totalPosts: number;
  totalLikes: number;
};

export type EngagementStats = {
  totalFollows: number;
  totalBookings: number;
  totalPosts: number;
  avgLikesPerPost: number;
};

export function shapeEngagementStats(input: EngagementStatsInput): EngagementStats {
  const avg = input.totalPosts > 0 ? input.totalLikes / input.totalPosts : 0;
  return {
    totalFollows: input.totalFollows,
    totalBookings: input.totalBookings,
    totalPosts: input.totalPosts,
    avgLikesPerPost: Math.round(avg * 10) / 10,
  };
}

// ─── Moderation stats ────────────────────────────────────────────────────────

export type ModerationStatsInput = {
  pendingReview: number;
  removedLast7Days: number;
  removedTotal: number;
};

export type ModerationStats = ModerationStatsInput;

export function shapeModerationStats(input: ModerationStatsInput): ModerationStats {
  return {
    pendingReview: input.pendingReview,
    removedLast7Days: input.removedLast7Days,
    removedTotal: input.removedTotal,
  };
}

// ─── Active sessions (DAU/WAU proxy) ─────────────────────────────────────────

export type SessionStatsInput = {
  activeLast7Days: number;
  activeLast30Days: number;
};

export type SessionStats = SessionStatsInput;

export function shapeSessionStats(input: SessionStatsInput): SessionStats {
  return {
    activeLast7Days: input.activeLast7Days,
    activeLast30Days: input.activeLast30Days,
  };
}

// ─── Top categories ──────────────────────────────────────────────────────────

const TOP_CATEGORIES_LIMIT = 5;

export type TopCategory = { category: string; count: number };

export function shapeTopCategories(rows: TopCategory[]): TopCategory[] {
  // Caller already sorts via SQL ORDER BY; we still slice defensively.
  return rows.slice(0, TOP_CATEGORIES_LIMIT);
}

// ─── Cache meta ──────────────────────────────────────────────────────────────

export type CacheMeta = {
  cachedAt: string;
  cacheExpiresAt: string;
};

export function buildCacheMeta(now: Date, ttlMs: number): CacheMeta {
  return {
    cachedAt: now.toISOString(),
    cacheExpiresAt: new Date(now.getTime() + ttlMs).toISOString(),
  };
}
