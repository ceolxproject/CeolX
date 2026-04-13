import { and, count, eq, gte } from 'drizzle-orm';

import { db } from '@CeolX/db';
import { events, savedEvents } from '@CeolX/db/schema/events';
import type { Event } from '@CeolX/db/schema/events';
import { artistProfiles, venueProfiles } from '@CeolX/db/schema/users';

import { typesenseClient } from '../lib/typesense';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type EnrichedEvent = Event & {
  creatorName: string;
  joinedCount: number;
};

function toTypesenseDoc(event: EnrichedEvent) {
  return {
    id: event.id,
    title: event.title,
    category: event.category,
    location: [parseFloat(event.lat), parseFloat(event.lng)] as [number, number],
    date_start: Math.floor(event.dateStart.getTime() / 1000),
    date_end: event.dateEnd ? Math.floor(event.dateEnd.getTime() / 1000) : undefined,
    venue_address: event.venueAddress ?? undefined,
    cover_image: event.coverImage ?? undefined,
    status: event.status,
    creator_id: event.createdBy,
    creator_name: event.creatorName,
    created_at: Math.floor(event.createdAt.getTime() / 1000),
    joined_count: event.joinedCount,
  };
}

async function enrichEvent(event: Event): Promise<EnrichedEvent> {
  const [artistRow, venueRow, [joinedRow]] = await Promise.all([
    db
      .select({ stageName: artistProfiles.stageName })
      .from(artistProfiles)
      .where(eq(artistProfiles.userId, event.createdBy))
      .limit(1),
    db
      .select({ venueName: venueProfiles.venueName })
      .from(venueProfiles)
      .where(eq(venueProfiles.userId, event.createdBy))
      .limit(1),
    db.select({ total: count() }).from(savedEvents).where(eq(savedEvents.eventId, event.id)),
  ]);

  return {
    ...event,
    creatorName: artistRow[0]?.stageName ?? venueRow[0]?.venueName ?? 'Unknown',
    joinedCount: joinedRow?.total ?? 0,
  };
}

// ---------------------------------------------------------------------------
// syncEventToTypesense — upsert a single event.
// Called on admin approval (status → active) or when an active event is updated.
// ---------------------------------------------------------------------------
export async function syncEventToTypesense(event: Event): Promise<void> {
  const enriched = await enrichEvent(event);
  const doc = toTypesenseDoc(enriched);
  await typesenseClient.collections('events').documents().upsert(doc);
}

// ---------------------------------------------------------------------------
// removeEventFromTypesense — delete a single event by ID.
// Called when an event is archived or rejected.
// Silently swallows 404 — safe to call even if the doc was never synced.
// ---------------------------------------------------------------------------
export async function removeEventFromTypesense(eventId: string): Promise<void> {
  try {
    await typesenseClient.collections('events').documents(eventId).delete();
  } catch (err: unknown) {
    // Ignore if document doesn't exist (already deleted or never synced)
    if (err instanceof Error && err.message.includes('Not Found')) return;
    throw err;
  }
}

// ---------------------------------------------------------------------------
// bulkSyncEventsToTypesense — fetch all active upcoming events from PostgreSQL
// (with creator names and joined counts) and bulk-import to Typesense.
// Used for initial seed and recovery.
// ---------------------------------------------------------------------------
export async function bulkSyncEventsToTypesense(): Promise<{ synced: number }> {
  const rows = await db
    .select({
      event: events,
      artistStageName: artistProfiles.stageName,
      venueName: venueProfiles.venueName,
    })
    .from(events)
    .leftJoin(artistProfiles, eq(artistProfiles.userId, events.createdBy))
    .leftJoin(venueProfiles, eq(venueProfiles.userId, events.createdBy))
    .where(and(eq(events.status, 'active'), gte(events.dateStart, new Date())));

  if (rows.length === 0) {
    return { synced: 0 };
  }

  // Fetch joined counts for all events in one query (no filter — we map by ID)
  const joinedCounts = await db
    .select({ eventId: savedEvents.eventId, total: count() })
    .from(savedEvents)
    .groupBy(savedEvents.eventId);

  const joinedByEventId = new Map(joinedCounts.map((r) => [r.eventId, r.total]));

  const docs = rows.map(({ event, artistStageName, venueName }) =>
    toTypesenseDoc({
      ...event,
      creatorName: artistStageName ?? venueName ?? 'Unknown',
      joinedCount: joinedByEventId.get(event.id) ?? 0,
    })
  );

  await typesenseClient.collections('events').documents().import(docs, { action: 'upsert' });

  return { synced: rows.length };
}
