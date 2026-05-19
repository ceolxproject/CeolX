import { and, eq, gte, isNotNull, lte, sql } from 'drizzle-orm';

import { db } from '@CeolX/db';
import { events } from '@CeolX/db/schema/events';
import { venueProfiles } from '@CeolX/db/schema/users';
import { feedAdsInputSchema } from '@CeolX/shared/validators';

import { publicProcedure } from '../../index';

const WINDOW_START_MIN = 30;
const WINDOW_END_MIN = 120;
const FEED_AD_LIMIT = 20;

export type FeedAd = {
  id: string;
  adTitle: string;
  adDescription: string | null;
  eventTitle: string;
  coverImage: string | null;
  venueName: string | null;
};

/**
 * Pure data fetcher — unit-testable without the tRPC wrapper.
 * Returns ads attached to events whose start time falls in the
 * [now + 30 min, now + 2 h] window.
 */
export async function fetchFeedAds(): Promise<FeedAd[]> {
  const rows = await db
    .select({
      id: events.id,
      adTitle: events.adTitle,
      adDescription: events.adDescription,
      eventTitle: events.title,
      coverImage: events.coverImage,
      venueName: venueProfiles.venueName,
    })
    .from(events)
    .leftJoin(venueProfiles, eq(venueProfiles.id, events.venueId))
    .where(
      and(
        eq(events.status, 'active'),
        isNotNull(events.adTitle),
        sql`length(trim(${events.adTitle})) > 0`,
        gte(events.dateStart, sql`now() + (${WINDOW_START_MIN} || ' minutes')::interval`),
        lte(events.dateStart, sql`now() + (${WINDOW_END_MIN} || ' minutes')::interval`)
      )
    )
    .orderBy(events.dateStart)
    .limit(FEED_AD_LIMIT);

  return rows.map((r) => ({
    id: r.id,
    adTitle: r.adTitle ?? '',
    adDescription: r.adDescription,
    eventTitle: r.eventTitle,
    coverImage: r.coverImage,
    venueName: r.venueName,
  }));
}

export const feedAds = publicProcedure.input(feedAdsInputSchema).query(async () => {
  return fetchFeedAds();
});
