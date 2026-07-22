import { publicProcedure } from '../../index';
import { typesenseClient } from '../../lib/typesense';

import { buildDateFilter, MapQueryInput } from './helpers';

export const getMap = publicProcedure.input(MapQueryInput).query(async ({ input }) => {
  const { swLat, swLng, neLat, neLng, query, limit, category, county } = input;
  const centerLat = (swLat + neLat) / 2;
  const centerLng = (swLng + neLng) / 2;
  const nowUnix = Math.floor(Date.now() / 1000);

  const categoryFilter = category ? ` && category:=${category}` : '';
  const countyFilter = county ? ` && venue_address:${county}` : '';
  const dateFilter = buildDateFilter(nowUnix);
  const searchQuery = query?.trim() || '*';

  try {
    const result = await typesenseClient
      .collections('events')
      .documents()
      .search({
        q: searchQuery,
        query_by: 'title,category,venue_address,venue_name',
        filter_by:
          `location:(${swLat},${swLng},${swLat},${neLng},${neLat},${neLng},${neLat},${swLng})` +
          dateFilter +
          ` && status:=active` +
          categoryFilter +
          countyFilter,
        sort_by:
          searchQuery === '*'
            ? `location(${centerLat},${centerLng}):asc`
            : `_text_match:desc,location(${centerLat},${centerLng}):asc`,
        per_page: limit,
      });

    const events = (result.hits ?? []).map((hit) => {
      const doc = hit.document as Record<string, unknown>;
      const loc = doc['location'];
      return {
        id: doc['id'] as string,
        title: doc['title'] as string,
        lat: Array.isArray(loc) ? (loc[0] as number) : 0,
        lng: Array.isArray(loc) ? (loc[1] as number) : 0,
        category: doc['category'] as string,
        dateStart: new Date((doc['date_start'] as number) * 1000).toISOString(),
        dateEnd: doc['date_end']
          ? new Date((doc['date_end'] as number) * 1000).toISOString()
          : undefined,
        venueAddress: (doc['venue_address'] as string) || undefined,
        coverImageUrl: (doc['cover_image'] as string) || undefined,
        distanceMeters: hit.geo_distance_meters?.location,
      };
    });

    return { events, totalCount: result.found ?? 0 };
  } catch (err) {
    console.error('[events.getMap] Typesense search failed:', err);
    return { events: [], totalCount: 0 };
  }
});
