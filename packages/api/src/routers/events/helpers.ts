import { TRPCError } from '@trpc/server';
import { z } from 'zod';

/** Stored venue coordinates (numeric columns surface as strings; either may be
 *  null for venues saved before coordinates were mandatory). */
export type VenueCoordsLookup = (
  venueId: string
) => Promise<{ lat: string | null; lng: string | null } | null>;

/**
 * Resolves the coordinates an event will be stored and indexed with.
 *
 * Map and feed are coordinate-driven (Typesense geopoint), so every event needs
 * a real pin. Resolution precedence:
 *   1. Explicit lat/lng from the client (a dropped pin).
 *   2. The selected registered venue's stored coordinates (inherited server-side).
 *
 * If neither yields coordinates, it throws — it never silently falls back to
 * (0,0), which previously dumped events into the Atlantic and made them vanish
 * from Discovery and the Map.
 *
 * Returns string coordinates ready for the numeric DB columns.
 */
export async function resolveEventCoordinates(
  // venueId is nullable — an explicit null clears the venue link, and the
  // truthiness check below already treats it the same as absent.
  input: { lat?: number; lng?: number; venueId?: string | null },
  lookupVenueCoords: VenueCoordsLookup
): Promise<{ lat: string; lng: string }> {
  if (input.lat !== undefined && input.lng !== undefined) {
    return { lat: input.lat.toString(), lng: input.lng.toString() };
  }

  if (input.venueId) {
    const venue = await lookupVenueCoords(input.venueId);
    if (venue && venue.lat !== null && venue.lng !== null) {
      return { lat: venue.lat, lng: venue.lng };
    }
  }

  throw new TRPCError({
    code: 'BAD_REQUEST',
    message:
      'Event location is required — drop a pin on the map or pick a registered venue with a saved location.',
  });
}

/**
 * Resolve the avatar URL to show for an event's creator or a collaborator.
 *
 * Uploaded profile pictures live in `artist_profiles`/`venue_profiles`
 * (`profileImageUrl`); the BetterAuth `user.image` column is only populated for
 * Google/Apple social logins. So the profile picture must win, with `user.image`
 * as a fallback for social-login accounts that never uploaded one. This mirrors
 * the precedence `hydrateAuthors` uses for posts. (Asana 1215429148917917)
 */
export function resolveProfileImageUrl(
  profile: { profileImageUrl: string | null } | null | undefined,
  fallbackUserImage: string | null | undefined
): string | null {
  return profile?.profileImageUrl ?? fallbackUserImage ?? null;
}

export const MapQueryInput = z.object({
  swLat: z.number(),
  swLng: z.number(),
  neLat: z.number(),
  neLng: z.number(),
  query: z.string().max(100).optional(),
  limit: z.number().int().min(1).max(50).default(50),
  category: z.string().optional(),
  county: z.string().optional(),
});

/**
 * Builds the Typesense date filter for the map, feed and search.
 *
 * The Typesense half of the has-it-finished rule — see `lib/event-window` for the why
 * and for the SQL form. Both branches test **overlap**, not "starts inside the window".
 *
 * The `||` rather than a COALESCE is a Typesense constraint, not a style choice:
 * `date_end` is optional in the schema and a range filter never matches a document that
 * lacks the field, so the start acts as the fallback.
 *
 *   - `day` — a single calendar day picked from the feed's calendar button, already
 *     resolved by the client to an absolute [start, end) Unix-second window. Filtered
 *     exactly as given (no server-side timezone math, since the server runs in UTC and
 *     would otherwise shift the day boundary; and no "earlier today" clamp, so a picked
 *     day shows every event on it — unchanged, and deliberate). Overlap is what makes
 *     day three of a multi-day festival list it.
 *   - Omitted — everything not yet finished.
 */
export function buildDateFilter(nowUnix: number, day?: { start: number; end: number }): string {
  if (day) {
    return ` && date_start:<${day.end} && (date_end:>=${day.start} || date_start:>=${day.start})`;
  }
  return ` && (date_end:>=${nowUnix} || date_start:>=${nowUnix})`;
}
