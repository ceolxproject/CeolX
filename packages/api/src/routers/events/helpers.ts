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
  input: { lat?: number; lng?: number; venueId?: string },
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
  dateRange: z.enum(['today', 'this_week', 'this_weekend', 'this_month']).optional(),
});

/**
 * Builds a Typesense date_start filter string.
 *
 * Precedence:
 *   1. `specificDate` (YYYY-MM-DD) — a single calendar day picked from the
 *      feed's calendar button. Overrides `dateRange` when both are present.
 *   2. `dateRange` — one of the named presets.
 *   3. Neither — everything from now onwards.
 */
export function buildDateFilter(
  dateRange: 'today' | 'this_week' | 'this_weekend' | 'this_month' | undefined,
  nowUnix: number,
  specificDate?: string
): string {
  if (specificDate) {
    // A single picked day, built server-local like the presets above so the
    // boundary behaviour stays uniform across both date filters.
    const [year, month, day] = specificDate.split('-').map(Number);
    const rangeStart = new Date(year, month - 1, day);
    const rangeEnd = new Date(year, month - 1, day + 1);
    const startUnix = Math.max(Math.floor(rangeStart.getTime() / 1000), nowUnix);
    const endUnix = Math.floor(rangeEnd.getTime() / 1000);
    return ` && date_start:>=${startUnix} && date_start:<${endUnix}`;
  }

  if (!dateRange) return ` && date_start:>=${nowUnix}`;

  const now = new Date();
  let rangeStart: Date;
  let rangeEnd: Date;

  switch (dateRange) {
    case 'today':
      rangeStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      rangeEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      break;
    case 'this_week': {
      const dayOfWeek = now.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      rangeStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);
      rangeEnd = new Date(
        rangeStart.getFullYear(),
        rangeStart.getMonth(),
        rangeStart.getDate() + 7
      );
      break;
    }
    case 'this_weekend': {
      const day = now.getDay();
      const satOffset = day === 0 ? -1 : 6 - day;
      rangeStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + satOffset);
      rangeEnd = new Date(
        rangeStart.getFullYear(),
        rangeStart.getMonth(),
        rangeStart.getDate() + 2
      );
      break;
    }
    case 'this_month':
      rangeStart = new Date(now.getFullYear(), now.getMonth(), 1);
      rangeEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      break;
  }

  const startUnix = Math.max(Math.floor(rangeStart.getTime() / 1000), nowUnix);
  const endUnix = Math.floor(rangeEnd.getTime() / 1000);
  return ` && date_start:>=${startUnix} && date_start:<${endUnix}`;
}
