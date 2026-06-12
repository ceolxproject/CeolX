import { useCallback, useEffect, useRef, useState } from 'react';
import type RNMapView from 'react-native-maps';
import type { Region } from 'react-native-maps';

import { usePlaceSearch } from '@/hooks/use-place-search';
import { getDeviceLocation } from '@/utils/device-location';
import { type GeocodeResult, reverseGeocode } from '@/utils/geocode';

const ZOOM = { latitudeDelta: 0.5, longitudeDelta: 0.5 };
const REVERSE_GEOCODE_DEBOUNCE_MS = 400;
export const PICKER_FALLBACK_LABEL = 'Selected location';

/**
 * Map-picker state shared by the Feed location sheet and the Add Location screen:
 * a draggable map whose centre is reverse-geocoded into a label, plus place
 * search that recenters the map. Extracted verbatim from FeedLocationSheet so the
 * two surfaces can't drift. Pan → debounced reverse-geocode; programmatic
 * recenters lock the label for one region-change so the animation can't clobber it.
 */
export function useLocationPickerMap(initialLat: number, initialLng: number) {
  const mapRef = useRef<RNMapView>(null);
  const centreRef = useRef({ lat: initialLat, lng: initialLng });
  const [label, setLabel] = useState(PICKER_FALLBACK_LABEL);
  const reverseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const labelLockedRef = useRef(false);
  const reverseReqIdRef = useRef(0);

  const search = usePlaceSearch();
  const { commitSelection, clearSearch, dismissDropdown } = search;

  useEffect(() => {
    return () => {
      if (reverseTimer.current) clearTimeout(reverseTimer.current);
    };
  }, []);

  const scheduleReverseGeocode = useCallback((lat: number, lng: number) => {
    if (reverseTimer.current) clearTimeout(reverseTimer.current);
    const reqId = ++reverseReqIdRef.current;
    reverseTimer.current = setTimeout(() => {
      void reverseGeocode(lat, lng).then((addr) => {
        if (addr && reqId === reverseReqIdRef.current) setLabel(addr);
      });
    }, REVERSE_GEOCODE_DEBOUNCE_MS);
  }, []);

  const handleRegionChangeComplete = useCallback(
    (region: Region) => {
      centreRef.current = { lat: region.latitude, lng: region.longitude };
      if (labelLockedRef.current) {
        labelLockedRef.current = false;
        return;
      }
      dismissDropdown();
      scheduleReverseGeocode(region.latitude, region.longitude);
    },
    [dismissDropdown, scheduleReverseGeocode]
  );

  const recentreTo = useCallback((lat: number, lng: number, nextLabel: string) => {
    reverseReqIdRef.current++;
    if (reverseTimer.current) clearTimeout(reverseTimer.current);
    centreRef.current = { lat, lng };
    setLabel(nextLabel);
    if (!mapRef.current) return;
    labelLockedRef.current = true;
    mapRef.current.animateToRegion({ latitude: lat, longitude: lng, ...ZOOM }, 600);
  }, []);

  const handleSelect = useCallback(
    (result: GeocodeResult) => {
      commitSelection(result.address);
      recentreTo(result.lat, result.lng, result.address);
    },
    [commitSelection, recentreTo]
  );

  const handleUseCurrentLocation = useCallback(async () => {
    const loc = await getDeviceLocation();
    if (loc) recentreTo(loc.lat, loc.lng, 'Current Location');
  }, [recentreTo]);

  /** Reset the pin + label to a fresh location (sheet re-open). */
  const reset = useCallback(
    (lat: number, lng: number) => {
      centreRef.current = { lat, lng };
      setLabel(PICKER_FALLBACK_LABEL);
      labelLockedRef.current = false;
      clearSearch();
    },
    [clearSearch]
  );

  const getCentre = useCallback(() => centreRef.current, []);

  return {
    mapRef,
    label,
    search,
    handleRegionChangeComplete,
    handleSelect,
    handleUseCurrentLocation,
    recentreTo,
    reset,
    getCentre,
    ZOOM,
  };
}
