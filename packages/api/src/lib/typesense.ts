import Typesense from 'typesense';
import type { CollectionCreateSchema } from 'typesense/lib/Typesense/Collections';

import { env } from '@CeolX/env/server';

export const typesenseClient = new Typesense.Client({
  nodes: [
    {
      host: env.TYPESENSE_HOST,
      port: env.TYPESENSE_PORT,
      protocol: env.TYPESENSE_PROTOCOL,
    },
  ],
  apiKey: env.TYPESENSE_API_KEY,
  connectionTimeoutSeconds: 5,
});

export const EVENTS_COLLECTION_SCHEMA: CollectionCreateSchema = {
  name: 'events',
  fields: [
    { name: 'id', type: 'string' },
    { name: 'title', type: 'string' },
    { name: 'category', type: 'string', facet: true },
    { name: 'location', type: 'geopoint' },
    { name: 'date_start', type: 'int64' },
    { name: 'date_end', type: 'int64', optional: true },
    { name: 'venue_address', type: 'string', optional: true },
    { name: 'venue_name', type: 'string', optional: true },
    { name: 'cover_image', type: 'string', optional: true },
    { name: 'status', type: 'string' },
    { name: 'creator_id', type: 'string' },
    { name: 'creator_name', type: 'string' },
    { name: 'created_at', type: 'int64' },
    { name: 'joined_count', type: 'int32' },
  ],
  default_sorting_field: 'date_start',
};
