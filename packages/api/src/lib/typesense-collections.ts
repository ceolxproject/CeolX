import { typesenseClient, EVENTS_COLLECTION_SCHEMA } from './typesense';

export async function ensureEventsCollection(): Promise<void> {
  try {
    await typesenseClient.collections('events').retrieve();
    // Collection already exists — nothing to do
  } catch {
    // Collection doesn't exist — create it
    await typesenseClient.collections().create(EVENTS_COLLECTION_SCHEMA);
  }
}
