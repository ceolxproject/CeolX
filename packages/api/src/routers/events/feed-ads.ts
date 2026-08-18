import { and, eq, gte, lte, sql } from 'drizzle-orm';

import { db } from '@CeolX/db';
import { events } from '@CeolX/db/schema/events';
import { venueProfiles } from '@CeolX/db/schema/users';
import { feedAdsInputSchema } from '@CeolX/shared/validators';

import { publicProcedure } from '../../index';
import { filterOutOnHoldVenueItems } from '../../services/venue-gate';

const WINDOW_START_MIN = 30;
const WINDOW_END_MIN = 120;
const FEED_AD_LIMIT = 20;

export type FeedAd = {
  id: string;
  adTitle: string | null;
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
      createdBy: events.createdBy,
    })
    .from(events)
    .leftJoin(venueProfiles, eq(venueProfiles.id, events.venueId))
    .where(
      and(
        eq(events.status, 'active'),
        // Ad Title and Ad Description are each independently optional — surface
        // the ad whenever either one is non-empty. (Mirrors the OfferBlock client gate.)
        sql`(length(trim(coalesce(${events.adTitle}, ''))) > 0 OR length(trim(coalesce(${events.adDescription}, ''))) > 0)`,
        gte(events.dateStart, sql`now() + (${WINDOW_START_MIN} || ' minutes')::interval`),
        lte(events.dateStart, sql`now() + (${WINDOW_END_MIN} || ' minutes')::interval`)
      )
    )
    .orderBy(events.dateStart)
    .limit(FEED_AD_LIMIT);

  // V-11 / D-44: an unpaid venue's ads come down. Sean asked for this explicitly
  // and the T&C says so.
  //
  // Note these are the `ad_title` / `ad_description` fields on an event, NOT the
  // paid Event Boost product — Boosts do not exist yet. When they do, withdrawing a
  // pre-paid Boost under a no-refund policy needs legal review before it ships
  // (D-44); this filter is not that.
  const visible = await filterOutOnHoldVenueItems(rows, (r) => r.createdBy);

  return visible.map((r) => ({
    id: r.id,
    adTitle: r.adTitle,
    adDescription: r.adDescription,
    eventTitle: r.eventTitle,
    coverImage: r.coverImage,
    venueName: r.venueName,
  }));
}

export const feedAds = publicProcedure.input(feedAdsInputSchema).query(async () => {
  return fetchFeedAds();
});
