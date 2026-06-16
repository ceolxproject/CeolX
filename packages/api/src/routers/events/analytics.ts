import { TRPCError } from '@trpc/server';
import { and, eq, gte, sql } from 'drizzle-orm';

import { db } from '@CeolX/db';
import { user } from '@CeolX/db/schema/auth';
import { bookings } from '@CeolX/db/schema/bookings';
import { eventCollaborators, events, eventViews, savedEvents } from '@CeolX/db/schema/events';
import { artistProfiles } from '@CeolX/db/schema/users';
import type { EventAnalyticsResponse } from '@CeolX/shared/validators';
import { eventAnalyticsInputSchema, trackTicketClickInputSchema } from '@CeolX/shared/validators';

import { protectedProcedure, publicProcedure } from '../../index';

import { resolveProfileImageUrl } from './helpers';

// ─── Public mutations ────────────────────────────────────────────────────────

// Public — anyone clicking an external ticket link counts. Idempotently
// increments the denormalised counter; missing eventIds simply update zero rows.
export const trackTicketClick = publicProcedure
  .input(trackTicketClickInputSchema)
  .mutation(async ({ input }) => {
    await db
      .update(events)
      .set({ ticketClicks: sql`${events.ticketClicks} + 1` })
      .where(eq(events.id, input.id));

    return { tracked: true } as const;
  });

// ─── Pure helpers (exported for unit tests) ──────────────────────────────────

function roundTo2dp(value: number): number {
  return Math.round(value * 100) / 100;
}

export function computeEngagementRate(saves: number, views: number): number {
  if (views <= 0) return 0;
  return roundTo2dp((saves / views) * 100);
}

export interface BookingStatusCounts {
  pending: number;
  accepted: number;
  rejected: number;
  cancelled: number;
}

export function computeAcceptanceRate(byStatus: BookingStatusCounts, total: number): number | null {
  if (total <= 0) return null;
  return roundTo2dp((byStatus.accepted / total) * 100);
}

export function computeClickRate(
  clicks: number,
  views: number,
  hasTicketLink: boolean
): number | null {
  if (!hasTicketLink) return null;
  if (views <= 0) return 0;
  return roundTo2dp((clicks / views) * 100);
}

export interface DailyViewBucketRow {
  day: string; // YYYY-MM-DD as returned by date_trunc cast to date::text
  count: number;
}

export interface DailyViewBucket {
  date: string;
  count: number;
}

// Returns exactly `days` entries ending at today (UTC), in chronological order.
// Missing days are filled with count=0 so the chart renders a continuous trend.
export function padDailyViews(rows: DailyViewBucketRow[], days: number): DailyViewBucket[] {
  const counts = new Map(rows.map((r) => [r.day, r.count]));
  const result: DailyViewBucket[] = [];

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const [key] = d.toISOString().split('T');
    if (!key) continue;
    result.push({ date: key, count: counts.get(key) ?? 0 });
  }

  return result;
}

// ─── In-memory analytics cache ───────────────────────────────────────────────
// Per-process Map keyed by eventId. 5-minute TTL balances freshness against
// the cost of running the parallel rollup queries on every load. A Redis
// migration would be straightforward — confined to the get/set lines below.

const CACHE_TTL_MS = 5 * 60 * 1000;
const ANALYTICS_DAYS = 14;

interface CacheEntry {
  data: EventAnalyticsResponse;
  expiresAt: number;
}
const analyticsCache = new Map<string, CacheEntry>();

// Test-only helper. Not imported by production code.
export function clearAnalyticsCache(): void {
  analyticsCache.clear();
}

// ─── analytics query ─────────────────────────────────────────────────────────

export const analytics = protectedProcedure
  .input(eventAnalyticsInputSchema)
  .query(async ({ input, ctx }): Promise<EventAnalyticsResponse> => {
    const event = await db.query.events.findFirst({
      where: eq(events.id, input.id),
    });

    if (!event) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' });
    }

    if (event.createdBy !== ctx.userId) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Only the event creator can view analytics',
      });
    }

    const cached = analyticsCache.get(input.id);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    const sinceDate = new Date(Date.now() - ANALYTICS_DAYS * 24 * 60 * 60 * 1000);

    const [savesRow, bookingRows, dailyRows, collaboratorRows] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(savedEvents)
        .where(eq(savedEvents.eventId, input.id)),

      db
        .select({
          status: bookings.status,
          count: sql<number>`count(*)::int`,
        })
        .from(bookings)
        .where(eq(bookings.eventId, input.id))
        .groupBy(bookings.status),

      db
        .select({
          day: sql<string>`to_char(date_trunc('day', ${eventViews.viewedAt}), 'YYYY-MM-DD')`,
          count: sql<number>`count(*)::int`,
        })
        .from(eventViews)
        .where(and(eq(eventViews.eventId, input.id), gte(eventViews.viewedAt, sinceDate)))
        .groupBy(sql`date_trunc('day', ${eventViews.viewedAt})`)
        .orderBy(sql`date_trunc('day', ${eventViews.viewedAt})`),

      db
        .select({
          artistProfileId: eventCollaborators.artistProfileId,
          invitedEmail: eventCollaborators.invitedEmail,
          stageName: artistProfiles.stageName,
          profileImageUrl: artistProfiles.profileImageUrl,
          userImage: user.image,
        })
        .from(eventCollaborators)
        .leftJoin(artistProfiles, eq(artistProfiles.userId, eventCollaborators.artistProfileId))
        .leftJoin(user, eq(user.id, eventCollaborators.artistProfileId))
        .where(eq(eventCollaborators.eventId, input.id)),
    ]);

    const totalSaves = savesRow[0]?.count ?? 0;
    const totalViews = event.viewCount ?? 0;
    const ticketClickCount = event.ticketClicks ?? 0;
    const hasTicketLink = !!event.ticketLink;

    const byStatus: BookingStatusCounts = { pending: 0, accepted: 0, rejected: 0, cancelled: 0 };
    for (const row of bookingRows) {
      if (row.status in byStatus) {
        byStatus[row.status] = row.count;
      }
    }
    const totalBookings =
      byStatus.pending + byStatus.accepted + byStatus.rejected + byStatus.cancelled;

    const confirmed = collaboratorRows.flatMap((r) =>
      r.artistProfileId
        ? [
            {
              artistProfileId: r.artistProfileId,
              stageName: r.stageName ?? 'Unknown Artist',
              profileImageUrl: resolveProfileImageUrl(
                { profileImageUrl: r.profileImageUrl },
                r.userImage
              ),
            },
          ]
        : []
    );
    const invitedCount = collaboratorRows.filter(
      (r) => r.artistProfileId === null && r.invitedEmail !== null
    ).length;

    const now = new Date();
    const expiresAt = new Date(now.getTime() + CACHE_TTL_MS);

    const data: EventAnalyticsResponse = {
      event: {
        id: event.id,
        title: event.title,
        coverImage: event.coverImage,
        dateStart: event.dateStart.toISOString(),
        dateEnd: event.dateEnd?.toISOString() ?? null,
        venueAddress: event.venueAddress,
        category: event.category,
        status: event.status,
        createdAt: event.createdAt.toISOString(),
        updatedAt: event.updatedAt.toISOString(),
        hasTicketLink,
      },
      views: {
        total: totalViews,
        daily: padDailyViews(dailyRows, ANALYTICS_DAYS),
      },
      saves: { total: totalSaves },
      engagement: { rate: computeEngagementRate(totalSaves, totalViews) },
      ticketClicks: {
        total: ticketClickCount,
        clickRate: computeClickRate(ticketClickCount, totalViews, hasTicketLink),
      },
      bookings: {
        total: totalBookings,
        byStatus,
        acceptanceRate: computeAcceptanceRate(byStatus, totalBookings),
      },
      performers: { confirmed, invitedCount },
      cachedAt: now.toISOString(),
      cacheExpiresAt: expiresAt.toISOString(),
    };

    analyticsCache.set(input.id, { data, expiresAt: expiresAt.getTime() });

    return data;
  });
