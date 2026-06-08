import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

import { env } from '@CeolX/env/native';
import { IRELAND_INITIAL_REGION } from '@CeolX/shared';

type MapRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

export type LocationSource = 'gps' | 'ip' | 'default' | 'pending' | 'venue-profile';

type GpsRegionResult = {
  initialRegion: MapRegion;
  gpsPermissionGranted: boolean;
  locationSource: LocationSource;
  /** Reverse-geocoded city/town for the resolved coordinates. `null` while pending or on failure. */
  placeLabel: string | null;
  /** Increment to remount MapView after region changes */
  mapKey: number;
};

const GPS_ZOOM = { latitudeDelta: 0.5, longitudeDelta: 0.5 };

type Setters = {
  setInitialRegion: (r: MapRegion) => void;
  setGpsPermissionGranted: (v: boolean) => void;
  setLocationSource: (s: LocationSource) => void;
  setMapKey: (fn: (k: number) => number) => void;
};

/**
 * Core fallback chain logic — exported for direct testing.
 *
 * Reads the OS permission state WITHOUT prompting (getForegroundPermissionsAsync).
 * The permission dialog is the responsibility of LocationPermissionScreen.
 *
 * 1. GPS granted + position available → user's location
 * 2. GPS denied or undetermined (or no position) → IP geolocation via server proxy
 * 3. IP fails → Ireland centre (53.1424, -7.6921)
 */
export async function resolveLocation(setters: Setters): Promise<void> {
  const { setInitialRegion, setGpsPermissionGranted, setLocationSource, setMapKey } = setters;

  try {
    const { status } = await Location.getForegroundPermissionsAsync();

    if (status === Location.PermissionStatus.GRANTED) {
      setGpsPermissionGranted(true);

      try {
        const pos = await Location.getLastKnownPositionAsync();
        if (pos) {
          setInitialRegion({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            ...GPS_ZOOM,
          });
          setLocationSource('gps');
          setMapKey((k) => k + 1);
          return;
        }
        // Permission granted but no cached position — fall through to IP
      } catch (err: unknown) {
        console.error('[resolveLocation] getLastKnownPositionAsync failed:', err);
        // Fall through to IP
      }
    }

    await resolveViaIp(setInitialRegion, setLocationSource, setMapKey);
  } catch (err: unknown) {
    console.error('[resolveLocation] Permission check failed:', err);
    setInitialRegion(IRELAND_INITIAL_REGION);
    setLocationSource('default');
  }
}

async function resolveViaIp(
  setRegion: (r: MapRegion) => void,
  setSource: (s: LocationSource) => void,
  setKey: (fn: (k: number) => number) => void
): Promise<void> {
  try {
    const res = await fetch(`${env.EXPO_PUBLIC_SERVER_URL}/location/ip`);

    if (!res.ok) {
      console.warn(
        '[resolveViaIp] Server returned',
        res.status,
        '— falling back to Ireland default'
      );
      setRegion(IRELAND_INITIAL_REGION);
      setSource('default');
      return;
    }

    const data = (await res.json()) as { ok: boolean; latitude?: number; longitude?: number };

    if (data.ok && typeof data.latitude === 'number' && typeof data.longitude === 'number') {
      setRegion({
        latitude: data.latitude,
        longitude: data.longitude,
        ...GPS_ZOOM,
      });
      setSource('ip');
      setKey((k) => k + 1);
      return;
    }
  } catch (err: unknown) {
    console.error('[resolveViaIp] IP geolocation fetch failed:', err);
  }

  // Explicit region reset — don't rely on useState initial value being correct
  setRegion(IRELAND_INITIAL_REGION);
  setSource('default');
}

/**
 * Decide whether a resolved location should be upgraded to the venue pin.
 * Pure — exported for testing.
 *
 * Only fires when the chain landed on the Ireland `'default'` (both GPS and IP
 * failed) AND a venue pin is available. GPS/IP/pending are never overridden, and
 * once the source is already `'venue-profile'` it returns null so the override
 * effect can't loop.
 */
export function applyVenueFallback(
  locationSource: LocationSource,
  venueFallback: { latitude: number; longitude: number } | null
): { region: MapRegion; source: LocationSource } | null {
  if (locationSource !== 'default' || !venueFallback) return null;
  return {
    region: { ...venueFallback, ...GPS_ZOOM },
    source: 'venue-profile',
  };
}

/**
 * Resolves the initial map region using a three-step fallback chain.
 *
 * @param enabled - Delay resolution while the location permission priming
 *   screen is visible. Defaults to true.
 */
export function useGpsRegion(
  enabled = true,
  venueFallback: { latitude: number; longitude: number } | null = null
): GpsRegionResult {
  const [initialRegion, setInitialRegion] = useState<MapRegion>(IRELAND_INITIAL_REGION);
  const [gpsPermissionGranted, setGpsPermissionGranted] = useState(false);
  const [locationSource, setLocationSource] = useState<LocationSource>('pending');
  const [placeLabel, setPlaceLabel] = useState<string | null>(null);
  const [mapKey, setMapKey] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    void resolveLocation({
      setInitialRegion,
      setGpsPermissionGranted,
      setLocationSource,
      setMapKey,
    });
  }, [enabled]);

  // Venue-only upgrade: if the chain bottomed out at the Ireland default and we
  // have the venue's saved pin, recenter on it. Self-heals if `useMe()` resolves
  // after the chain (Ireland → pin). Keyed on the pin's coords, not object
  // identity, so a fresh-but-equal fallback object won't re-fire.
  useEffect(() => {
    const upgrade = applyVenueFallback(locationSource, venueFallback);
    if (!upgrade) return;
    setInitialRegion(upgrade.region);
    setLocationSource(upgrade.source);
    setMapKey((k) => k + 1);
  }, [locationSource, venueFallback?.latitude, venueFallback?.longitude]);

  // Reverse-geocode whenever we have real coordinates (GPS, IP, or the venue
  // pin). Failures are non-fatal — consumers fall back to a source-based label.
  useEffect(() => {
    if (locationSource !== 'gps' && locationSource !== 'ip' && locationSource !== 'venue-profile') {
      setPlaceLabel(null);
      return;
    }

    let cancelled = false;
    Location.reverseGeocodeAsync({
      latitude: initialRegion.latitude,
      longitude: initialRegion.longitude,
    })
      .then((results) => {
        if (cancelled) return;
        const first = results[0];
        if (!first) return;
        const label = first.city ?? first.subregion ?? first.region;
        if (label) setPlaceLabel(label);
      })
      .catch((err: unknown) => {
        console.warn('[useGpsRegion] reverseGeocodeAsync failed:', err);
      });

    return () => {
      cancelled = true;
    };
  }, [initialRegion.latitude, initialRegion.longitude, locationSource]);

  return { initialRegion, gpsPermissionGranted, locationSource, placeLabel, mapKey };
}
