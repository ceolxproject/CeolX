import { and, eq, ilike, or, sql } from 'drizzle-orm';

import { db } from '@CeolX/db';
import { user } from '@CeolX/db/schema/auth';
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

// Artist suggestions for the search box. The placeholder promises "Find Music,
// Artist or Event", so the term is matched against four things:
//   - stage name (the public artist name),
//   - account name (matched like `artists.search`, never displayed — GDPR),
//   - the deprecated `genre` varchar, and
//   - any element of the `genres[]` array.
// The genre matches are what make a *music* query ("Trad", "Folk") surface the
// artists who play it — without them the dropdown only ever matched stage names,
// so genre searches returned nothing (Asana 1216029035897869).
// Visible profiles only (`isActive`); sub-line = first genre.
async function suggestArtists(term: string): Promise<Suggestion[]> {
  const pattern = `%${term}%`;
  const rows = await db
    .select({
      userId: artistProfiles.userId,
      stageName: artistProfiles.stageName,
      genres: artistProfiles.genres,
      imageUrl: artistProfiles.profileImageUrl,
    })
    .from(artistProfiles)
    .innerJoin(user, eq(artistProfiles.userId, user.id))
    .where(
      and(
        eq(artistProfiles.isActive, true),
        or(
          ilike(artistProfiles.stageName, pattern),
          ilike(user.name, pattern),
          ilike(artistProfiles.genre, pattern),
          sql`EXISTS (SELECT 1 FROM unnest(${artistProfiles.genres}) AS g WHERE g ILIKE ${pattern})`
        )
      )
    )
    .limit(GROUP_LIMIT);

  return dedupeByLabel(
    rows.map((r) => ({
      label: r.stageName,
      sublabel: r.genres?.[0] || undefined,
      imageUrl: r.imageUrl || undefined,
      artistId: r.userId,
    }))
  );
}

// Venue-name matches, only venues whose subscription is active (i.e. visible).
async function suggestVenues(term: string): Promise<Suggestion[]> {
  const rows = await db
    .select({
      userId: venueProfiles.userId,
      venueName: venueProfiles.venueName,
      imageUrl: venueProfiles.profileImageUrl,
    })
    .from(venueProfiles)
    .where(
      and(
        ilike(venueProfiles.venueName, `%${term}%`),
        eq(venueProfiles.subscriptionStatus, 'active')
      )
    )
    .limit(GROUP_LIMIT);

  return dedupeByLabel(
    rows.map((r) => ({
      label: r.venueName,
      imageUrl: r.imageUrl || undefined,
      // The venue profile route keys off the owner's user id (see venue/[venueId]).
      venueId: r.userId,
    }))
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
