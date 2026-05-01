import { and, count, countDistinct, desc, eq, gte, lt, ne, sql } from 'drizzle-orm';

import { db } from '@CeolX/db';
import { session, user } from '@CeolX/db/schema/auth';
import { bookings } from '@CeolX/db/schema/bookings';
import { events } from '@CeolX/db/schema/events';
import { follows, posts } from '@CeolX/db/schema/social';
import { venueProfiles } from '@CeolX/db/schema/users';

import { adminProcedure } from '../../index';
import {
  buildCacheMeta,
  shapeBookingStats,
  shapeEngagementStats,
  shapeEventStats,
  shapeModerationStats,
  shapeSessionStats,
  shapeSubscriptionStats,
  shapeTopCategories,
  shapeUserStats,
} from '../../lib/admin-stats';
import { TtlCache } from '../../utils/ttl-cache';

const DAY_MS = 24 * 60 * 60 * 1000;
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_KEY = 'admin:stats:v2';

// Module-level cache survives across requests within a single Lambda instance
// (or local server). Spec R23/R24/AC8 — 5-minute TTL bypasses heavier infra.
// Cache invalidation on data mutations (R24) is deferred; staleness ≤ 5 minutes
// is acceptable at V1 (<1,000 users).
type StatsResponse = Awaited<ReturnType<typeof computeStats>>;
const statsCache = new TtlCache<StatsResponse>();

export const stats = adminProcedure.query(async () => {
  const cached = statsCache.get(CACHE_KEY);
  if (cached) return cached;

  const fresh = await computeStats();
  statsCache.set(CACHE_KEY, fresh, CACHE_TTL_MS);
  return fresh;
});

async function computeStats() {
  const now = new Date();
  const last7 = new Date(now.getTime() - 7 * DAY_MS);
  const last14 = new Date(now.getTime() - 14 * DAY_MS);
  const last30 = new Date(now.getTime() - 30 * DAY_MS);
  const prev30Start = new Date(now.getTime() - 60 * DAY_MS);

  const nonAdmin = ne(user.currentRole, 'admin');

  // Note: venue subscription "new in last 30 days" uses updatedAt as a proxy
  // for activated_at, since no dedicated column exists. Acceptable at V1
  // (<1,000 users); revisit when subscription history lands.
  const [
    usersByRole,
    usersNew7,
    usersNew30,
    usersPrev7,
    usersPrev30,
    eventsByStatus,
    eventsNew7,
    eventsNew30,
    eventsPrev7,
    eventsPrev30,
    activeVenuesRows,
    pastDueRows,
    venueSubsNew30,
    venueSubsPrev30,
    followsRow,
    bookingsByStatusRows,
    postsCountRow,
    postsLikesSumRow,
    pendingRow,
    removedLast7Row,
    removedTotalRow,
    topCategoriesRows,
    activeSessions7Row,
    activeSessions30Row,
  ] = await Promise.all([
    db
      .select({ role: user.currentRole, count: count() })
      .from(user)
      .where(nonAdmin)
      .groupBy(user.currentRole),
    db
      .select({ count: count() })
      .from(user)
      .where(and(nonAdmin, gte(user.createdAt, last7))),
    db
      .select({ count: count() })
      .from(user)
      .where(and(nonAdmin, gte(user.createdAt, last30))),
    db
      .select({ count: count() })
      .from(user)
      .where(and(nonAdmin, gte(user.createdAt, last14), lt(user.createdAt, last7))),
    db
      .select({ count: count() })
      .from(user)
      .where(and(nonAdmin, gte(user.createdAt, prev30Start), lt(user.createdAt, last30))),
    db.select({ status: events.status, count: count() }).from(events).groupBy(events.status),
    db.select({ count: count() }).from(events).where(gte(events.createdAt, last7)),
    db.select({ count: count() }).from(events).where(gte(events.createdAt, last30)),
    db
      .select({ count: count() })
      .from(events)
      .where(and(gte(events.createdAt, last14), lt(events.createdAt, last7))),
    db
      .select({ count: count() })
      .from(events)
      .where(and(gte(events.createdAt, prev30Start), lt(events.createdAt, last30))),
    db
      .select({ count: count() })
      .from(venueProfiles)
      .where(eq(venueProfiles.subscriptionStatus, 'active')),
    db
      .select({ count: count() })
      .from(venueProfiles)
      .where(eq(venueProfiles.subscriptionStatus, 'past_due')),
    db
      .select({ count: count() })
      .from(venueProfiles)
      .where(
        and(eq(venueProfiles.subscriptionStatus, 'active'), gte(venueProfiles.updatedAt, last30))
      ),
    db
      .select({ count: count() })
      .from(venueProfiles)
      .where(
        and(
          eq(venueProfiles.subscriptionStatus, 'active'),
          gte(venueProfiles.updatedAt, prev30Start),
          lt(venueProfiles.updatedAt, last30)
        )
      ),
    db.select({ count: count() }).from(follows),
    db.select({ status: bookings.status, count: count() }).from(bookings).groupBy(bookings.status),
    db.select({ count: count() }).from(posts),
    db.select({ total: sql<number>`coalesce(sum(${posts.likeCount}), 0)::int` }).from(posts),
    db.select({ count: count() }).from(events).where(eq(events.status, 'pending_review')),
    db
      .select({ count: count() })
      .from(events)
      .where(and(eq(events.status, 'removed'), gte(events.updatedAt, last7))),
    db.select({ count: count() }).from(events).where(eq(events.status, 'removed')),
    db
      .select({ category: events.category, count: count() })
      .from(events)
      .where(ne(events.status, 'draft'))
      .groupBy(events.category)
      .orderBy(desc(count()))
      .limit(5),
    db
      .select({ count: countDistinct(session.userId) })
      .from(session)
      .where(gte(session.createdAt, last7)),
    db
      .select({ count: countDistinct(session.userId) })
      .from(session)
      .where(gte(session.createdAt, last30)),
  ]);

  const cacheMeta = buildCacheMeta(now, CACHE_TTL_MS);

  return {
    users: shapeUserStats({
      byRole: usersByRole.map((r) => ({ role: r.role, count: r.count })),
      newLast7Days: usersNew7[0]?.count ?? 0,
      newLast30Days: usersNew30[0]?.count ?? 0,
      newPrev7Days: usersPrev7[0]?.count ?? 0,
      newPrev30Days: usersPrev30[0]?.count ?? 0,
    }),
    events: shapeEventStats({
      byStatus: eventsByStatus.map((r) => ({ status: r.status, count: r.count })),
      newLast7Days: eventsNew7[0]?.count ?? 0,
      newLast30Days: eventsNew30[0]?.count ?? 0,
      newPrev7Days: eventsPrev7[0]?.count ?? 0,
      newPrev30Days: eventsPrev30[0]?.count ?? 0,
    }),
    subscriptions: shapeSubscriptionStats({
      activeVenues: activeVenuesRows[0]?.count ?? 0,
      pastDueCount: pastDueRows[0]?.count ?? 0,
      newLast30Days: venueSubsNew30[0]?.count ?? 0,
      newPrev30Days: venueSubsPrev30[0]?.count ?? 0,
    }),
    bookings: shapeBookingStats({
      byStatus: bookingsByStatusRows.map((r) => ({ status: r.status, count: r.count })),
    }),
    engagement: shapeEngagementStats({
      totalFollows: followsRow[0]?.count ?? 0,
      totalBookings: bookingsByStatusRows.reduce((sum, r) => sum + r.count, 0),
      totalPosts: postsCountRow[0]?.count ?? 0,
      totalLikes: Number(postsLikesSumRow[0]?.total ?? 0),
    }),
    moderation: shapeModerationStats({
      pendingReview: pendingRow[0]?.count ?? 0,
      removedLast7Days: removedLast7Row[0]?.count ?? 0,
      removedTotal: removedTotalRow[0]?.count ?? 0,
    }),
    topCategories: shapeTopCategories(
      topCategoriesRows.map((r) => ({ category: r.category, count: r.count }))
    ),
    sessions: shapeSessionStats({
      activeLast7Days: activeSessions7Row[0]?.count ?? 0,
      activeLast30Days: activeSessions30Row[0]?.count ?? 0,
    }),
    // Backwards-compat alias retained for the sidebar badge until next admin
    // refactor. Same value as moderation.pendingReview.
    pendingModeration: pendingRow[0]?.count ?? 0,
    cachedAt: cacheMeta.cachedAt,
    cacheExpiresAt: cacheMeta.cacheExpiresAt,
  };
}
