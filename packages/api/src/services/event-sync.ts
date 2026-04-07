import { and, eq, gte } from 'drizzle-orm';

import { db } from '@CeolX/db';
import { events } from '@CeolX/db/schema/events';
import type { Event } from '@CeolX/db/schema/events';

import { typesenseClient } from '../lib/typesense';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toTypesenseDoc(event: Event) {
  return {
    id: event.id,
    title: event.title,
    category: event.category,
    location: [parseFloat(event.lat), parseFloat(event.lng)] as [number, number],
    date_start: Math.floor(event.dateStart.getTime() / 1000),
    date_end: event.dateEnd ? Math.floor(event.dateEnd.getTime() / 1000) : undefined,
    venue_address: event.venueAddress ?? undefined,
    cover_image: event.coverImage ?? undefined,
    is_gig_opportunity: event.isGigOpportunity ?? false,
    status: event.status,
  };
}

// ---------------------------------------------------------------------------
// syncEventToTypesense — upsert a single event.
// Called on admin approval (status → active) or when an active event is updated.
// ---------------------------------------------------------------------------
export async function syncEventToTypesense(event: Event): Promise<void> {
  const doc = toTypesenseDoc(event);
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
// and bulk-import them to Typesense. Used for initial seed and recovery.
// ---------------------------------------------------------------------------
export async function bulkSyncEventsToTypesense(): Promise<{ synced: number }> {
  const rows = await db
    .select()
    .from(events)
    .where(and(eq(events.status, 'active'), gte(events.dateStart, new Date())));

  if (rows.length === 0) {
    return { synced: 0 };
  }

  const docs = rows.map(toTypesenseDoc);
  await typesenseClient.collections('events').documents().import(docs, { action: 'upsert' });

  return { synced: rows.length };
}
