import { adminProcedure } from '../../index';
import { ensureEventsCollection } from '../../lib/typesense-collections';
import { bulkSyncEventsToTypesense } from '../../services/event-sync';

/**
 * Admin maintenance — ensure the Typesense `events` collection exists, then
 * bulk-reindex all active upcoming events from Postgres.
 *
 * Run this after a Typesense cluster swap or outage to repopulate Discovery and
 * the Map without a manual curl. Idempotent: ensureEventsCollection is a no-op
 * when the collection already exists, and bulkSyncEventsToTypesense upserts.
 */
export const resyncEvents = adminProcedure.mutation(async () => {
  await ensureEventsCollection();
  const { synced } = await bulkSyncEventsToTypesense();
  return { collectionReady: true as const, synced };
});
