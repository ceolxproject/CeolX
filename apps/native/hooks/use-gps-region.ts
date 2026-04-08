import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

import { IRELAND_INITIAL_REGION } from '@CeolX/shared';

type MapRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

type GpsRegionResult = {
  initialRegion: MapRegion;
  gpsGranted: boolean;
  /** Increment to remount MapView after region changes */
  mapKey: number;
};

const GPS_ZOOM = { latitudeDelta: 0.5, longitudeDelta: 0.5 };

/**
 * Resolves the initial map region using the GPS fallback chain:
 * 1. GPS granted + last known position → user's location
 * 2. GPS denied or no position → Ireland centre
 */
export function useGpsRegion(): GpsRegionResult {
  const [initialRegion, setInitialRegion] = useState<MapRegion>(IRELAND_INITIAL_REGION);
  const [gpsGranted, setGpsGranted] = useState(false);
  const [mapKey, setMapKey] = useState(0);

  useEffect(() => {
    void (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== Location.PermissionStatus.GRANTED) return;
        setGpsGranted(true);
        const pos = await Location.getLastKnownPositionAsync();
        if (pos) {
          setInitialRegion({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            ...GPS_ZOOM,
          });
          setMapKey((k) => k + 1);
        }
      } catch {
        // Silently fall back to Ireland centre
      }
    })();
  }, []);

  return { initialRegion, gpsGranted, mapKey };
}
