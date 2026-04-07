import { typesenseClient, EVENTS_COLLECTION_SCHEMA } from './typesense';

export async function ensureEventsCollection(): Promise<void> {
  try {
    await typesenseClient.collections('events').retrieve();
    // Collection already exists — nothing to do
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('Not Found')) {
      await typesenseClient.collections().create(EVENTS_COLLECTION_SCHEMA);
    } else {
      throw err;
    }
  }
}
