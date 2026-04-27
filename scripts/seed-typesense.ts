/**
 * One-shot script: recreate the Typesense events collection with the current
 * schema and bulk-import all active upcoming events from Postgres.
 *
 * Usage (from repo root):
 *   node --env-file=apps/server/.env node_modules/.pnpm/tsx@4.21.0/node_modules/tsx/dist/cli.mjs scripts/seed-typesense.ts
 */

import { typesenseClient } from '../packages/api/src/lib/typesense';
import { ensureEventsCollection } from '../packages/api/src/lib/typesense-collections';
import { bulkSyncEventsToTypesense } from '../packages/api/src/services/event-sync';

async function main() {
  // Drop existing collection so the new schema (with creator_id, creator_name,
  // created_at, joined_count) is applied cleanly.
  try {
    await typesenseClient.collections('events').delete();
    console.warn('Dropped existing events collection.');
  } catch {
    console.warn('No existing collection to drop (first run).');
  }

  await ensureEventsCollection();
  console.warn('Created events collection with updated schema.');

  const { synced } = await bulkSyncEventsToTypesense();
  console.warn(`Synced ${synced} events to Typesense.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
