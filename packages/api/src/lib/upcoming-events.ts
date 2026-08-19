import { and, countDistinct, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { unionAll } from 'drizzle-orm/pg-core';

import { db } from '@CeolX/db';
import { bookings } from '@CeolX/db/schema/bookings';
import { eventCollaborators, events } from '@CeolX/db/schema/events';

import { eventNotFinished } from './event-window';

/**
 * Upcoming-event count per artist, keyed by the artist's user id.
 *
 * "Upcoming" has one definition across the product: a **distinct** ACTIVE,
 * future-dated event where the artist is either the creator OR a *confirmed*
 * collaborator. Confirmed means the `event_collaborators` row has no booking
 * (legacy direct-add, pre-31/05/2026) or one whose booking is `accepted` —
 * pending and declined invites must not count. Counting raw
 * `event_collaborators` rows instead drifts above the number the artist profile
 * actually renders, because that ignores created events and includes
 * archived/pending/past ones. (Asana 1216032428715513)
 *
 * Artists with no upcoming events are absent from the map rather than mapped to
 * 0 — callers decide whether that reads as "0" or "unknown".
 *
 * `events.byId` computes the same count inline for the Performing Artist badge
 * and `artists.byId` derives it from the fetched rows. Those two predate this
 * helper; fold them in when either is next touched so the definition lives in
 * one place.
 */
export async function countUpcomingEventsByArtist(
  artistUserIds: string[]
): Promise<Map<string, number>> {
  if (artistUserIds.length === 0) return new Map();

  const createdUpcoming = db
    .select({ artistId: events.createdBy, eventId: events.id })
    .from(events)
    .where(
      and(inArray(events.createdBy, artistUserIds), eq(events.status, 'active'), eventNotFinished())
    );

  const collaboratedUpcoming = db
    // artistProfileId is nullable in the schema but the inArray filter below
    // excludes nulls; cast so the union shape matches createdUpcoming.
    .select({ artistId: sql<string>`${eventCollaborators.artistProfileId}`, eventId: events.id })
    .from(eventCollaborators)
    .innerJoin(events, eq(events.id, eventCollaborators.eventId))
    .where(
      and(
        inArray(eventCollaborators.artistProfileId, artistUserIds),
        eq(events.status, 'active'),
        eventNotFinished(),
        or(
          isNull(eventCollaborators.bookingId),
          sql`EXISTS (SELECT 1 FROM ${bookings} WHERE ${bookings.id} = ${eventCollaborators.bookingId} AND ${bookings.status} = 'accepted')`
        )
      )
    );

  const upcomingArtistEvents = unionAll(createdUpcoming, collaboratedUpcoming).as(
    'upcoming_artist_events'
  );

  const rows = await db
    .select({
      artistId: upcomingArtistEvents.artistId,
      count: countDistinct(upcomingArtistEvents.eventId),
    })
    .from(upcomingArtistEvents)
    .groupBy(upcomingArtistEvents.artistId);

  return new Map(rows.map((r) => [r.artistId, Number(r.count)]));
}
