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
 * search that recenters the map. Pan → debounced reverse-geocode; programmatic
 * recenters lock the label for one region-change so the animation can't clobber it.
 *
 * Consume the returned read-only place-search fields and `handleSelect` — do not
 * reach into place-search imperatively; use `reset()` to clear and `handleSelect()`
 * to pick a result, so the label-lock and debounce refs stay consistent.
 */
export function useLocationPickerMap(initialLat: number, initialLng: number) {
  const mapRef = useRef<RNMapView>(null);
  const centreRef = useRef({ lat: initialLat, lng: initialLng });
  const [label, setLabel] = useState(PICKER_FALLBACK_LABEL);
  const reverseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const labelLockedRef = useRef(false);
  const reverseReqIdRef = useRef(0);
  // Which coordinates the current `label` actually describes. The centre updates
  // on every pan but the label trails it by a debounce + a network round-trip, so
  // without this a pan-then-confirm saves the previous place's address against the
  // new pin — the "address doesn't match the map" bug, one step removed.
  const labelCoordsRef = useRef({ lat: initialLat, lng: initialLng });
  // Whether the user has actually positioned the map (panned, searched, or used
  // GPS) since it opened. Callers that open without an existing pin gate their
  // confirm on this, so an untouched map can't be saved as a real location.
  const [hasUserMoved, setHasUserMoved] = useState(false);

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
        if (addr && reqId === reverseReqIdRef.current) {
          labelCoordsRef.current = { lat, lng };
          setLabel(addr);
        }
      });
    }, REVERSE_GEOCODE_DEBOUNCE_MS);
  }, []);

  /**
   * The label for wherever the pin is *right now* — awaits a fresh reverse-geocode
   * when the debounced one hasn't caught up. Confirm must go through this, never
   * read `label` directly, or it saves a stale address against a moved pin.
   */
  const resolveLabelForCentre = useCallback(async (): Promise<string> => {
    const { lat, lng } = centreRef.current;
    const known = labelCoordsRef.current;
    // The placeholder never counts as resolved, however well its coordinates line
    // up — otherwise confirming an untouched map persists "Selected location".
    if (label !== PICKER_FALLBACK_LABEL && known.lat === lat && known.lng === lng) return label;

    if (reverseTimer.current) clearTimeout(reverseTimer.current);
    const reqId = ++reverseReqIdRef.current;
    const addr = await reverseGeocode(lat, lng);
    // Falling back to the placeholder here would persist "Selected location" as a
    // live event's address whenever this one call fails. Coordinates are ugly but
    // true, and they still describe the pin.
    if (!addr) return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    if (reqId === reverseReqIdRef.current) {
      labelCoordsRef.current = { lat, lng };
      setLabel(addr);
    }
    return addr;
  }, [label]);

  const handleRegionChangeComplete = useCallback(
    (region: Region) => {
      centreRef.current = { lat: region.latitude, lng: region.longitude };
      if (labelLockedRef.current) {
        labelLockedRef.current = false;
        // The settled region IS the programmatic target (a picked suggestion, a
        // recentre, or the initial layout). Keep the label's coordinates in step
        // with it: the map never settles bit-identically to what we asked for, and
        // that drift would make a just-picked suggestion look stale on confirm and
        // get its name re-geocoded away.
        labelCoordsRef.current = { lat: region.latitude, lng: region.longitude };
        return;
      }
      setHasUserMoved(true);
      dismissDropdown();
      scheduleReverseGeocode(region.latitude, region.longitude);
    },
    [dismissDropdown, scheduleReverseGeocode]
  );

  const recentreTo = useCallback((lat: number, lng: number, nextLabel: string) => {
    reverseReqIdRef.current++;
    if (reverseTimer.current) clearTimeout(reverseTimer.current);
    setHasUserMoved(true);
    centreRef.current = { lat, lng };
    labelCoordsRef.current = { lat, lng };
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

  /**
   * Reset the pin + label to a fresh location (sheet re-open). Pass `nextLabel`
   * when the caller already knows the address — otherwise confirming without
   * panning would save the placeholder over a perfectly good stored address.
   */
  const reset = useCallback(
    (lat: number, lng: number, nextLabel: string = PICKER_FALLBACK_LABEL) => {
      // Invalidate anything still in flight from the previous session, the way
      // recentreTo does — otherwise a late reverse-geocode lands after the reset
      // and overwrites the freshly seeded label with the old location's address.
      reverseReqIdRef.current++;
      if (reverseTimer.current) clearTimeout(reverseTimer.current);
      centreRef.current = { lat, lng };
      labelCoordsRef.current = { lat, lng };
      setLabel(nextLabel);
      setHasUserMoved(false);
      // Swallow the map's initial layout settle so it neither re-geocodes over a
      // label the caller already knows nor counts as the user positioning the map.
      labelLockedRef.current = true;
      clearSearch();
    },
    [clearSearch]
  );

  /**
   * Clear just the search text + suggestions (the field's ✕ button). Leaves the
   * pin/label where they are — clearing a typo shouldn't move the map.
   */
  const clearQuery = useCallback(() => {
    clearSearch();
  }, [clearSearch]);

  const getCentre = useCallback(() => ({ ...centreRef.current }), []);

  return {
    mapRef,
    label,
    hasUserMoved,
    // place search (read-only surface — imperative methods stay internal to the hook)
    query: search.query,
    suggestions: search.suggestions,
    isDropdownVisible: search.isDropdownVisible,
    isSearching: search.isSearching,
    hasError: search.hasError,
    onChangeText: search.onChangeText,
    handleRegionChangeComplete,
    handleSelect,
    handleUseCurrentLocation,
    clearQuery,
    reset,
    getCentre,
    resolveLabelForCentre,
    ZOOM,
  };
}
