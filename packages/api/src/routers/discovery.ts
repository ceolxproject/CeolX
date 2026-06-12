import { and, eq, ilike } from 'drizzle-orm';

import { db } from '@CeolX/db';
import { artistProfiles, venueProfiles } from '@CeolX/db/schema/users';
import { suggestSchema, type Suggestion } from '@CeolX/shared/validators';

import { protectedProcedure, router } from '../index';
import { typesenseClient } from '../lib/typesense';

// Per-group cap. Keeps the dropdown short and the fan-out queries cheap.
const GROUP_LIMIT = 5;

// Drops repeat labels (same artist/venue/event name) while preserving order.
function dedupeByLabel(items: Suggestion[]): Suggestion[] {
  const seen = new Set<string>();
  const out: Suggestion[] = [];
  for (const item of items) {
    if (seen.has(item.label)) continue;
    seen.add(item.label);
    out.push(item);
  }
  return out;
}

// Artist stage-name matches, visible profiles only (isActive mirrors the
// `bookings.searchArtists` / `posts/feed.ts` visibility rule). Sub-line = genre.
async function suggestArtists(term: string): Promise<Suggestion[]> {
  const rows = await db
    .select({
      stageName: artistProfiles.stageName,
      genres: artistProfiles.genres,
      imageUrl: artistProfiles.profileImageUrl,
    })
    .from(artistProfiles)
    .where(and(ilike(artistProfiles.stageName, `%${term}%`), eq(artistProfiles.isActive, true)))
    .limit(GROUP_LIMIT);

  return dedupeByLabel(
    rows.map((r) => ({
      label: r.stageName,
      sublabel: r.genres?.[0] || undefined,
      imageUrl: r.imageUrl || undefined,
    }))
  );
}

// Venue-name matches, only venues whose subscription is active (i.e. visible).
async function suggestVenues(term: string): Promise<Suggestion[]> {
  const rows = await db
    .select({ venueName: venueProfiles.venueName, imageUrl: venueProfiles.profileImageUrl })
    .from(venueProfiles)
    .where(
      and(
        ilike(venueProfiles.venueName, `%${term}%`),
        eq(venueProfiles.subscriptionStatus, 'active')
      )
    )
    .limit(GROUP_LIMIT);

  return dedupeByLabel(
    rows.map((r) => ({ label: r.venueName, imageUrl: r.imageUrl || undefined }))
  );
}

// Event-title matches from Typesense (typo-tolerant). Degrades to an empty group
// on a Typesense outage so artist/venue suggestions still render, mirroring the
// `.catch` fallback in `events.getFeed`.
async function suggestEvents(term: string): Promise<Suggestion[]> {
  const res = await typesenseClient
    .collections('events')
    .documents()
    .search({
      q: term,
      query_by: 'title',
      filter_by: 'status:=active',
      // Over-fetch so de-dup still leaves a full group of distinct titles.
      per_page: 20,
    })
    .catch((err: unknown) => {
      console.warn(
        '[discovery.suggest] typesense unreachable, returning empty events group:',
        err instanceof Error ? `${err.name}: ${err.message}` : err
      );
      return { hits: [] };
    });

  const suggestions: Suggestion[] = (res.hits ?? []).map((hit) => {
    const doc = (hit as { document: Record<string, unknown> }).document;
    const venueAddress = (doc['venue_address'] as string) || undefined;
    return {
      label: doc['title'] as string,
      // Kept for callers that only read the flat sub-line; the redesigned row
      // prefers `location` + `dateStart` below.
      sublabel: venueAddress,
      imageUrl: (doc['cover_image'] as string) || undefined,
      location: venueAddress,
      dateStart: (doc['date_start'] as number) || undefined,
    };
  });

  return dedupeByLabel(suggestions).slice(0, GROUP_LIMIT);
}

export const discoveryRouter = router({
  // Autocomplete for the Discover search box. `scope` tailors which groups load:
  // the Posts tab has no event entity to suggest, so it skips Typesense entirely.
  suggest: protectedProcedure.input(suggestSchema).query(async ({ input }) => {
    const { q, scope } = input;
    const [artists, venues, events] = await Promise.all([
      suggestArtists(q),
      suggestVenues(q),
      scope === 'events' ? suggestEvents(q) : Promise.resolve<Suggestion[]>([]),
    ]);
    return { artists, venues, events };
  }),
});
