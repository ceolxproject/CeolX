import { useMemo } from 'react';

import { isValidCoordinate } from '@CeolX/shared';
import { UserRole } from '@CeolX/shared/enums';

import { useMe } from '@/hooks/use-me';

export type VenueFallback = { latitude: number; longitude: number } | null;

type MeLike =
  | {
      currentRole?: string | null;
      venueProfile?: { lat?: number | null; lng?: number | null } | null;
    }
  | null
  | undefined;

/**
 * Pure selector — exported for direct testing.
 *
 * Returns the logged-in venue's saved pin, or null. Only the venue persona has
 * a canonical pin; spectators/artists/guests always get null. The coordinate is
 * validated (bounds + null-island rejection) so a bad pin can never drag the
 * map into the Atlantic — it just falls through to the Ireland default.
 */
export function selectVenueFallback(me: MeLike): VenueFallback {
  if (me?.currentRole !== UserRole.VENUE) return null;
  const lat = me.venueProfile?.lat;
  const lng = me.venueProfile?.lng;
  // typeof guard narrows for TS; isValidCoordinate adds bounds + null-island checks.
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (!isValidCoordinate(lat, lng)) return null;
  return { latitude: lat, longitude: lng };
}

/**
 * Surfaces the venue's saved pin as a location fallback for the map/feed.
 * Reads the shared `users.me` query cache (no extra request). Stable identity
 * via useMemo so it can sit safely in effect dependency arrays.
 */
export function useVenueFallback(): VenueFallback {
  const { data: me } = useMe();
  return useMemo(
    () => selectVenueFallback(me),
    [me?.currentRole, me?.venueProfile?.lat, me?.venueProfile?.lng]
  );
}
