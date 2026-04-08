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

export type LocationSource = 'gps' | 'ip' | 'default' | 'pending';

type GpsRegionResult = {
  initialRegion: MapRegion;
  gpsGranted: boolean;
  locationSource: LocationSource;
  /** Increment to remount MapView after region changes */
  mapKey: number;
};

const GPS_ZOOM = { latitudeDelta: 0.5, longitudeDelta: 0.5 };

type Setters = {
  setInitialRegion: (r: MapRegion) => void;
  setGpsGranted: (v: boolean) => void;
  setLocationSource: (s: LocationSource) => void;
  setMapKey: (fn: (k: number) => number) => void;
};

/**
 * Core fallback chain logic — exported for direct testing.
 * 1. GPS granted + position → user's location
 * 2. GPS denied (or no position) → IP geolocation via server proxy
 * 3. IP fails → Ireland centre
 */
export async function resolveLocation(setters: Setters): Promise<void> {
  const { setInitialRegion, setGpsGranted, setLocationSource, setMapKey } = setters;

  try {
    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status === Location.PermissionStatus.GRANTED) {
      setGpsGranted(true);
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
    }

    await resolveViaIp(setInitialRegion, setLocationSource, setMapKey);
  } catch {
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
  } catch {
    // Fall through to default
  }

  setSource('default');
}

/**
 * Resolves the initial map region using a three-step fallback chain:
 * 1. GPS granted + position available → user's location
 * 2. GPS denied (or no position) → IP geolocation via server proxy
 * 3. IP fails → Ireland centre (53.1424, -7.6921)
 */
export function useGpsRegion(): GpsRegionResult {
  const [initialRegion, setInitialRegion] = useState<MapRegion>(IRELAND_INITIAL_REGION);
  const [gpsGranted, setGpsGranted] = useState(false);
  const [locationSource, setLocationSource] = useState<LocationSource>('pending');
  const [mapKey, setMapKey] = useState(0);

  useEffect(() => {
    void resolveLocation({ setInitialRegion, setGpsGranted, setLocationSource, setMapKey });
  }, []);

  return { initialRegion, gpsGranted, locationSource, mapKey };
}
