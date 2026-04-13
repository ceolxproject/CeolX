import { typesenseClient, EVENTS_COLLECTION_SCHEMA } from './typesense';

export async function ensureEventsCollection(): Promise<void> {
  try {
    await typesenseClient.collections('events').retrieve();
    // Collection already exists — nothing to do
  } catch (err: unknown) {
    // Typesense throws ObjectNotFound (httpStatus 404) when collection doesn't exist
    if (err && typeof err === 'object' && 'httpStatus' in err && err.httpStatus === 404) {
      await typesenseClient.collections().create(EVENTS_COLLECTION_SCHEMA);
    } else {
      throw err;
    }
  }
}
