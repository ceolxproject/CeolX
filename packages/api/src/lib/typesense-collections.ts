import { typesenseClient, EVENTS_COLLECTION_SCHEMA } from './typesense';

export async function ensureEventsCollection(): Promise<void> {
  try {
    const existing = await typesenseClient.collections('events').retrieve();
    const existingFieldNames = new Set(existing.fields.map((field) => field.name));
    // `id` is Typesense's implicit primary key — it's never echoed back by retrieve()
    // and can't be altered, so it must never be treated as a missing field.
    const missingFields = EVENTS_COLLECTION_SCHEMA.fields.filter(
      (field) => field.name !== 'id' && !existingFieldNames.has(field.name)
    );
    // Typesense collections are otherwise immutable — new optional fields (e.g. venue_name)
    // must be added via the schema-update API or they're silently absent from query_by.
    if (missingFields.length > 0) {
      await typesenseClient.collections('events').update({ fields: missingFields });
    }
  } catch (err: unknown) {
    // Typesense throws ObjectNotFound (httpStatus 404) when collection doesn't exist
    if (err && typeof err === 'object' && 'httpStatus' in err && err.httpStatus === 404) {
      await typesenseClient.collections().create(EVENTS_COLLECTION_SCHEMA);
    } else {
      throw err;
    }
  }
}
