import { TRPCError } from '@trpc/server';

import { publicProcedure } from '../../index';
import { typesenseClient } from '../../lib/typesense';
import { filterOutOnHoldVenueItems } from '../../services/venue-gate';

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
        creatorId: (doc['creator_id'] as string) || null,
      };
    });

    // V-03: drop events created BY an on-hold venue. Artist-created events at that
    // venue deliberately stay (V-06), which is why this filters on the creator
    // rather than on the venue the event names.
    //
    // Post-filtered rather than indexed, per D-54 — see services/venue-gate.ts.
    const visible = await filterOutOnHoldVenueItems(events, (e) => e.creatorId);
    const removed = events.length - visible.length;

    return {
      // `found` is Typesense's pre-filter total, so subtract what this page dropped.
      // Still approximate for pages we did not fetch — acceptable because the map
      // caps at 50 pins and the count drives a label, not pagination.
      events: visible.map(({ creatorId: _creatorId, ...rest }) => rest),
      totalCount: Math.max(0, (result.found ?? 0) - removed),
    };
  } catch (err) {
    console.error('[events.getMap] Typesense search failed:', err);
    // Returning an empty result here made an outage indistinguishable from "no
    // events in this area": the client's radius expansion would walk 5 → 25 →
    // 100km, get three empty successes, and confidently tell the user there is
    // nothing near them. Throwing surfaces isError so the error toast shows.
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to fetch map events',
      cause: err,
    });
  }
});
