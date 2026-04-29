import { and, count, eq, gte, lt, ne } from 'drizzle-orm';

import { db } from '@CeolX/db';
import { user } from '@CeolX/db/schema/auth';
import { bookings } from '@CeolX/db/schema/bookings';
import { events } from '@CeolX/db/schema/events';
import { follows, posts } from '@CeolX/db/schema/social';
import { venueProfiles } from '@CeolX/db/schema/users';

import { adminProcedure } from '../../index';
import { shapeEventStats, shapeSubscriptionStats, shapeUserStats } from '../../lib/admin-stats';

const DAY_MS = 24 * 60 * 60 * 1000;

export const stats = adminProcedure.query(async () => {
  const now = new Date();
  const last7 = new Date(now.getTime() - 7 * DAY_MS);
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
    usersPrev30,
    eventsByStatus,
    eventsNew7,
    eventsNew30,
    eventsPrev30,
    activeVenuesRows,
    pastDueRows,
    venueSubsNew30,
    venueSubsPrev30,
    followsRow,
    bookingsRow,
    postsRow,
    pendingRow,
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
      .where(and(nonAdmin, gte(user.createdAt, prev30Start), lt(user.createdAt, last30))),
    db.select({ status: events.status, count: count() }).from(events).groupBy(events.status),
    db.select({ count: count() }).from(events).where(gte(events.createdAt, last7)),
    db.select({ count: count() }).from(events).where(gte(events.createdAt, last30)),
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
    db.select({ count: count() }).from(bookings),
    db.select({ count: count() }).from(posts),
    db.select({ count: count() }).from(events).where(eq(events.status, 'pending_review')),
  ]);

  return {
    users: shapeUserStats({
      byRole: usersByRole.map((r) => ({ role: r.role, count: r.count })),
      newLast7Days: usersNew7[0]?.count ?? 0,
      newLast30Days: usersNew30[0]?.count ?? 0,
      newPrev30Days: usersPrev30[0]?.count ?? 0,
    }),
    events: shapeEventStats({
      byStatus: eventsByStatus.map((r) => ({ status: r.status, count: r.count })),
      newLast7Days: eventsNew7[0]?.count ?? 0,
      newLast30Days: eventsNew30[0]?.count ?? 0,
      newPrev30Days: eventsPrev30[0]?.count ?? 0,
    }),
    subscriptions: shapeSubscriptionStats({
      activeVenues: activeVenuesRows[0]?.count ?? 0,
      pastDueCount: pastDueRows[0]?.count ?? 0,
      newLast30Days: venueSubsNew30[0]?.count ?? 0,
      newPrev30Days: venueSubsPrev30[0]?.count ?? 0,
    }),
    engagement: {
      totalFollows: followsRow[0]?.count ?? 0,
      totalBookings: bookingsRow[0]?.count ?? 0,
      totalPosts: postsRow[0]?.count ?? 0,
    },
    pendingModeration: pendingRow[0]?.count ?? 0,
  };
});
