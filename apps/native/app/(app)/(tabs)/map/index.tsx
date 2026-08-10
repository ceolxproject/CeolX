import * as Sentry from '@sentry/react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Modal, Platform, Text, View } from 'react-native';
// Plain react-native-maps MapView (no clustering wrapper). Clustering is driven
// in JS by `useMapClusters`/supercluster, which keeps single-marker keys stable
// so they don't remount every region change — the churn that broke the old
// react-native-map-clustering@4 wrapper under the New Architecture
// (ViewAttacherGroup "View already has a parent" → blank pins, Asana 1215453288289175).
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import type RNMapView from 'react-native-maps';
import type { Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EVENT_CATEGORIES, IRISH_COUNTIES, filterValidMapEvents } from '@CeolX/shared';

import { AppHeader } from '@/components/AppHeader';
import { appToast } from '@/components/AppToast';
import { FilterSheet } from '@/components/FilterSheet';
import type { FilterSection } from '@/components/FilterSheet';
import { LocationBanner } from '@/components/LocationBanner';
import { LocationIndicator } from '@/components/LocationIndicator';
import { LocationPermissionScreen } from '@/components/LocationPermissionScreen';
import { LocationSheet } from '@/components/LocationSheet';
import type { ClusterObject } from '@/components/MapClusterMarker';
import { MapClusterMarker } from '@/components/MapClusterMarker';
import { MapEdgePointers } from '@/components/MapEdgePointers';
import { MapEmptyStateCard } from '@/components/MapEmptyStateCard';
import { MapErrorBoundary } from '@/components/MapErrorBoundary';
import type { MapEvent } from '@/components/MapEventMarker';
import { MapEventMarker } from '@/components/MapEventMarker';
import { MapOverlappingEventsSheet } from '@/components/MapOverlappingEventsSheet';
import { MapRecenterButton } from '@/components/MapRecenterButton';
import { MapSearchBar } from '@/components/MapSearchBar';
import { PlaceSuggestionsDropdown } from '@/components/PlaceSuggestionsDropdown';
import { TAB_BAR_HEIGHT } from '@/constants/layout';
import {
  MAP_HEADER_HEIGHT,
  MAP_SEARCH_BAR_GAP,
  MAP_SEARCH_BAR_HEIGHT,
} from '@/constants/map-layout';
import { useAuth } from '@/contexts/auth-context';
import { useLocationOverride } from '@/contexts/location-override-context';
import { useTabBarVisibility } from '@/contexts/tab-bar-visibility-context';
import { resolveMapInitialRegion, useGpsRegion } from '@/hooks/use-gps-region';
import { useLocationPermissionPrompt } from '@/hooks/use-location-permission-prompt';
import type { MapClusterPoint } from '@/hooks/use-map-clusters';
import {
  CLUSTER_MAX_ZOOM,
  isClusterFeature,
  useMapClusters,
  zoomToRegion,
} from '@/hooks/use-map-clusters';
import { useMapEvents } from '@/hooks/use-map-events';
import { useMapEdgePointers } from '@/hooks/use-map-pointers';
import { usePlaceSearch } from '@/hooks/use-place-search';
import { useVenueFallback } from '@/hooks/use-venue-fallback';
import { getDeviceLocation } from '@/utils/device-location';
import { resolveFeedLocation } from '@/utils/feed-location';
import type { FeedLocation } from '@/utils/feed-location';
import type { GeocodeResult } from '@/utils/geocode';

// Town/neighbourhood zoom. Tight enough to read pins, wide enough that a pick
// doesn't land on an empty patch — a venue-level delta usually would.
const MAP_FOCUS_DELTA = 0.15;

const MAP_FILTER_SECTIONS: FilterSection[] = [
  { key: 'category', label: 'Category', options: EVENT_CATEGORIES, showIcons: true },
  { key: 'county', label: 'County', options: IRISH_COUNTIES },
];

export default function MapScreen() {
  const mapRef = useRef<RNMapView>(null);
  // "lat,lng" of the override we last centred on, so the focus effect re-centres
  // only when the override actually changed (e.g. set from the Feed) and never
  // fights a centre we just applied ourselves via a place pick.
  const lastAppliedOverrideRef = useRef<string | null>(null);
  const router = useRouter();
  // Read insets HERE (inside the root SafeAreaProvider), where they're measured
  // correctly. The permission Modal renders in a separate native window whose
  // own SafeAreaProvider reports bottom = 0 on Android, so we pass these
  // known-good values into it rather than letting it re-measure.
  const insets = useSafeAreaInsets();
  // Push the map's native UI controls (notably the Android "My Location" button,
  // which Google pins to the top-right) below the header + search bar so they
  // clear the status bar and stay tappable. Mirrors MapSearchBar's top offset.
  const mapTopPadding =
    insets.top + MAP_HEADER_HEIGHT + MAP_SEARCH_BAR_GAP + MAP_SEARCH_BAR_HEIGHT + 12;
  // Bottom-anchored overlays (error toast) must clear the still-visible tab bar.
  const bottomOverlayOffset = insets.bottom + TAB_BAR_HEIGHT + 16;
  // The recenter button sits tighter to the tab bar than the centered overlays —
  // a small gap above the bar so it reads as anchored to the bottom-right corner.
  const recenterButtonBottom = insets.bottom + 12;
  const { user } = useAuth();
  // Per-user keyed — guests pass `undefined` and fall through to the lazy prompt.
  const { promptState, markSeen } = useLocationPermissionPrompt(user?.id);
  // Shared with the Feed tab — a manual place pick on either screen syncs here.
  const { override, overrideKind, setOverride, clearOverride } = useLocationOverride();
  const venueFallback = useVenueFallback();
  const { initialRegion, gpsPermissionGranted, locationSource, placeLabel, mapKey } = useGpsRegion(
    promptState === 'done',
    venueFallback
  );
  // A manual override wins over the GPS/IP region for where the map opens.
  const effectiveInitialRegion = resolveMapInitialRegion(override, initialRegion);
  // The active location shown in the header chip — same resolution the Feed uses,
  // so both screens read identically.
  const effectiveLocation = resolveFeedLocation(
    override,
    initialRegion,
    placeLabel,
    locationSource
  );
  const [locationSheetVisible, setLocationSheetVisible] = useState(false);
  const mapEventsResult = useMapEvents();
  const rawEvents = mapEventsResult.events as MapEvent[];
  const events = useMemo(() => {
    const { valid, invalid } = filterValidMapEvents(rawEvents);

    if (invalid.length > 0) {
      console.error(`Invalid map event coordinates (${invalid.length} events)`, invalid);
      Sentry.captureMessage('Invalid map event coordinates', {
        level: 'warning',
        extra: { count: invalid.length, events: invalid },
      });
    }

    return valid;
  }, [rawEvents]);
  const {
    isLoading,
    isError,
    expandExhausted,
    onRegionChangeComplete,
    filters,
    setFilters,
    activeFilterCount,
  } = mapEventsResult;
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [emptyCardDismissed, setEmptyCardDismissed] = useState(false);
  // Live map region (null until the first settle) — drives clustering. Fall back
  // to initialRegion so the first paint is already clustered.
  const [region, setRegion] = useState<Region | null>(null);
  // Events sharing (near-)identical coords that a cluster can't zoom apart.
  const [overlapEvents, setOverlapEvents] = useState<MapEvent[] | null>(null);

  // While the same-location sheet owns the bottom of the screen, hide the tab
  // bar + FAB so the overlay sits flush against the bottom. Re-assert on focus
  // and always restore on blur so it can't get stuck hidden on another tab.
  const { setHidden: setTabBarHidden } = useTabBarVisibility();
  const isOverlapSheetOpen = Boolean(overlapEvents);
  // A failure outranks "nothing here". Gating the toast on !expandExhausted let a
  // stale exhausted flag from an earlier sweep swallow a real backend error and
  // report it as "No events near here" — the exact misdiagnosis the getMap throw
  // exists to prevent.
  const errorToastVisible = !isLoading && isError;
  const emptyStateVisible = !isLoading && !isError && expandExhausted && !emptyCardDismissed;
  // A centered bottom card/toast/sheet shares the recenter button's row — hide
  // the button while one is shown so they never overlap.
  const bottomOverlayBusy = isOverlapSheetOpen || emptyStateVisible || errorToastVisible;
  useFocusEffect(
    useCallback(() => {
      setTabBarHidden(isOverlapSheetOpen);
      return () => setTabBarHidden(false);
    }, [isOverlapSheetOpen, setTabBarHidden])
  );

  const { clusters, supercluster } = useMapClusters(events, region ?? effectiveInitialRegion);

  // Every deliberate camera move (place pick, override, recenter, pointer tap)
  // lands at the same town-level zoom, so they all go through here.
  const focusPoint = useCallback((lat: number, lng: number, duration = 600) => {
    mapRef.current?.animateToRegion(
      {
        latitude: lat,
        longitude: lng,
        latitudeDelta: MAP_FOCUS_DELTA,
        longitudeDelta: MAP_FOCUS_DELTA,
      },
      duration
    );
  }, []);

  const handleClusterPress = useCallback(
    (clusterId: number, lat: number, lng: number) => {
      const expansionZoom = Math.min(
        supercluster.getClusterExpansionZoom(clusterId),
        CLUSTER_MAX_ZOOM
      );
      // Can't be zoomed apart (events at the same spot) → let the user pick.
      if (expansionZoom >= CLUSTER_MAX_ZOOM) {
        const leaves = supercluster.getLeaves(clusterId, Infinity);
        setOverlapEvents(leaves.map((leaf) => leaf.properties.event));
        return;
      }
      mapRef.current?.animateToRegion(zoomToRegion(lat, lng, expansionZoom), 350);
    },
    [supercluster]
  );

  // Tapping a single pin opens the event detail directly — no preview card
  // (Asana 1215961153969025). The overlapping-events sheet stays for stacked
  // pins a cluster can't separate.
  const openEvent = useCallback(
    (event: MapEvent) => router.push(`/(app)/(tabs)/map/event/${event.id}`),
    [router]
  );

  const renderMarker = useCallback(
    (feature: MapClusterPoint) => {
      const [lng, lat] = feature.geometry.coordinates;
      if (isClusterFeature(feature)) {
        const clusterId = feature.properties.cluster_id;
        const cluster: ClusterObject = {
          id: clusterId,
          geometry: { coordinates: [lng, lat] },
          properties: { point_count: feature.properties.point_count },
          onPress: () => handleClusterPress(clusterId, lat, lng),
        };
        return <MapClusterMarker key={`cluster-${clusterId}`} cluster={cluster} />;
      }
      const event = feature.properties.event;
      return <MapEventMarker key={event.id} event={event} onSelect={openEvent} />;
    },
    [handleClusterPress, openEvent]
  );

  const showBanner = !bannerDismissed && (locationSource === 'ip' || locationSource === 'default');
  const bannerMessage =
    locationSource === 'ip'
      ? 'Using approximate location — search to refine.'
      : 'Could not determine your location. Search for a county or city.';

  const {
    query: searchText,
    suggestions,
    isSearching,
    isDropdownVisible,
    hasError: placeSearchError,
    onChangeText: onPlaceChangeText,
    dismissDropdown,
    commitSelection,
    clearSearch,
  } = usePlaceSearch();

  // Surface a place-search failure as a non-blocking toast. Pins are never
  // cleared on a failed search — the map keeps whatever it was showing.
  useEffect(() => {
    if (placeSearchError) {
      appToast.error("Couldn't search places", 'Check your connection and try again.');
    }
  }, [placeSearchError]);

  // Anything that owns the screen — a sheet, the suggestion list, a bottom card.
  // The recenter button only cares about the bottom row; pointers cover the
  // edges, so they stand down for all of it.
  //
  // Keyed on the dropdown being open, NOT on the box holding text: committing a
  // place pick leaves the chosen name in the box, and that is precisely when the
  // user has landed somewhere empty and needs the arrows most.
  const mapChromeBusy = bottomOverlayBusy || filterSheetVisible || isDropdownVisible;

  // The viewport query is padded (MAP_VIEWPORT_PAD_FACTOR) and empty viewports
  // silently expand to 100km, so the map often holds events the user cannot
  // see. Point at them instead of showing a blank map.
  const edgePointers = useMapEdgePointers({
    events,
    region: region ?? effectiveInitialRegion,
    locationSource,
    home: initialRegion,
    enabled: !isLoading && !mapChromeBusy,
    onFocus: focusPoint,
  });

  const handlePlaceSelect = useCallback(
    (result: GeocodeResult) => {
      if (!mapRef.current) return;
      // Picking a suggestion finishes the search — drop the keyboard so the map
      // result is fully visible (matches the Discover screen's select behaviour).
      Keyboard.dismiss();
      // The map settling triggers onRegionChangeComplete → the viewport query.
      focusPoint(result.lat, result.lng, 800);
      commitSelection(result.address);
      // Sync this intentional pick to the Feed. Mark it as already-applied so the
      // focus effect doesn't animate to the same spot again on the next focus.
      lastAppliedOverrideRef.current = `${result.lat},${result.lng}`;
      setOverride({ lat: result.lat, lng: result.lng, label: result.address }, 'search');
    },
    [commitSelection, setOverride, focusPoint]
  );

  // Tapping the header chip opens the same picker the Feed uses. A confirm is a
  // temporary search; the focus effect (below) recentres the map when it lands.
  const handleLocationConfirm = useCallback(
    (loc: FeedLocation) => {
      setOverride(loc, 'search');
      setLocationSheetVisible(false);
    },
    [setOverride]
  );

  // Resetting the chip drops the temporary search AND clears the search bar text,
  // so the box doesn't keep showing the place we just navigated away from. The
  // focus effect recentres the map back to the saved/default region.
  const handleLocationReset = useCallback(() => {
    clearOverride();
    clearSearch();
  }, [clearOverride, clearSearch]);

  // Feed → Map: when the shared override changes (e.g. set from the Feed's
  // location sheet) and differs from what we last centred on, recentre on focus.
  // Free panning never writes the override, so this only fires for deliberate
  // picks. Guarded by the ref so re-focusing without a change is a no-op.
  useFocusEffect(
    useCallback(() => {
      if (!override) {
        // Override was cleared (reset, here or on the Feed) — return to the
        // resolved saved/default region. `initialRegion` already encodes the
        // saved-base → GPS → IP chain, so it is the correct target. Only animate
        // if we'd previously centred on an override (ref non-null), so a fresh
        // load with no override doesn't fight the initialRegion.
        if (lastAppliedOverrideRef.current !== null) {
          lastAppliedOverrideRef.current = null;
          focusPoint(initialRegion.latitude, initialRegion.longitude);
        }
        return;
      }
      const key = `${override.lat},${override.lng}`;
      if (lastAppliedOverrideRef.current === key) return;
      lastAppliedOverrideRef.current = key;
      focusPoint(override.lat, override.lng);
    }, [override, initialRegion, focusPoint])
  );

  const handleRegionChangeComplete = useCallback(
    (nextRegion: Region) => {
      setRegion(nextRegion);
      onRegionChangeComplete(nextRegion);
    },
    [onRegionChangeComplete]
  );

  const handleMapPress = useCallback(() => {
    // RN has no "tap outside → blur" behaviour: the search keyboard stays up
    // until something explicitly dismisses it. A tap on the map should close it.
    Keyboard.dismiss();
    dismissDropdown();
  }, [dismissDropdown]);

  // Custom circular recenter control (replaces Google's square native button).
  // getDeviceLocation prompts for permission if needed and returns null on denial.
  const handleRecenter = useCallback(async () => {
    const loc = await getDeviceLocation();
    if (!loc) {
      appToast.error('Location unavailable', 'Enable location access to center the map.');
      return;
    }
    focusPoint(loc.lat, loc.lng);
  }, [focusPoint]);

  if (promptState === 'checking') return null;
  if (promptState === 'show') {
    // navigationBarTranslucent draws the modal window edge-to-edge under the
    // Android nav bar; the sheet then pads itself by `insets.bottom` (passed in
    // from the activity above) to clear it. Passing insets avoids the modal's
    // own SafeAreaProvider, which reports bottom = 0 here.
    return (
      <Modal visible animationType="none" statusBarTranslucent navigationBarTranslucent>
        <LocationPermissionScreen
          onDone={async (opts) => {
            await markSeen();
            if (opts?.viaManualSelection) router.push('/add-location');
          }}
          insets={insets}
        />
      </Modal>
    );
  }

  return (
    <View className="flex-1 bg-[#080808]">
      {/* Full-screen map */}
      <MapErrorBoundary>
        <MapView
          ref={mapRef}
          key={mapKey}
          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          initialRegion={effectiveInitialRegion}
          mapPadding={{ top: mapTopPadding, right: 0, bottom: 0, left: 0 }}
          onRegionChangeComplete={handleRegionChangeComplete}
          onPress={handleMapPress}
          showsUserLocation={Boolean(gpsPermissionGranted)}
          // Hide Google's square native button — we render our own circular
          // recenter control (MapRecenterButton) for UI consistency.
          showsMyLocationButton={false}
          // Edge pointers rotate an arrow by a geographic bearing. A rotated map
          // would make that bearing disagree with what's on screen, so the
          // gesture is off rather than threading camera heading through the math.
          rotateEnabled={false}
          userInterfaceStyle={'dark' as const}
        >
          {clusters.map(renderMarker)}
        </MapView>
      </MapErrorBoundary>

      <AppHeader variant="floating" leading="back" />
      {/* Live location chip in the header band, right of the back pill. The back
          pill is a 48px control inset by px-4 (right edge at 64px); start at 80px
          so there's a clear 16px gap and the two dark pills don't merge. Mirrors
          the Feed's location indicator so both screens read the same. box-none
          lets taps fall through the empty area to the map below. */}
      <View
        pointerEvents="box-none"
        className="absolute left-20 right-4 h-[52px] flex-row items-center"
        style={{ top: insets.top }}
      >
        <LocationIndicator
          variant="floating"
          label={effectiveLocation.label}
          isSearch={overrideKind === 'search'}
          onPress={() => setLocationSheetVisible(true)}
          onReset={handleLocationReset}
        />
      </View>
      <MapSearchBar
        value={searchText}
        onChangeText={onPlaceChangeText}
        onClear={clearSearch}
        onFilterPress={() => setFilterSheetVisible(true)}
        activeFilterCount={activeFilterCount}
      />

      {/* Recenter control — hidden while a bottom card / toast / preview is shown. */}
      {!bottomOverlayBusy && (
        <MapRecenterButton onPress={handleRecenter} bottom={recenterButtonBottom} />
      )}

      {showBanner && (
        <LocationBanner message={bannerMessage} onDismiss={() => setBannerDismissed(true)} />
      )}

      {isDropdownVisible && (
        <PlaceSuggestionsDropdown
          suggestions={suggestions}
          isSearching={isSearching}
          onSelect={handlePlaceSelect}
        />
      )}

      {isLoading && (
        <ActivityIndicator
          style={{ position: 'absolute', alignSelf: 'center', top: mapTopPadding }}
          size="large"
          color="#6155F5"
        />
      )}

      {edgePointers.visible && (
        <MapEdgePointers pointers={edgePointers.pointers} onSelect={edgePointers.select} />
      )}

      {emptyStateVisible && (
        <MapEmptyStateCard
          onDismiss={() => setEmptyCardDismissed(true)}
          onBrowseAll={() => router.push('/(app)/(tabs)/discover')}
        />
      )}

      {errorToastVisible && (
        <View
          className="absolute self-center z-10 bg-[rgba(43,43,43,0.95)] px-5 py-4 rounded-2xl max-w-[300px]"
          style={{ bottom: bottomOverlayOffset }}
        >
          <Text className="text-white text-[14px] text-center">
            Could not load events. Check your connection and try again.
          </Text>
        </View>
      )}

      {overlapEvents && (
        <MapOverlappingEventsSheet events={overlapEvents} onClose={() => setOverlapEvents(null)} />
      )}

      <FilterSheet
        visible={filterSheetVisible}
        filters={filters}
        sections={MAP_FILTER_SECTIONS}
        onApply={(f) => setFilters(f)}
        onClose={() => setFilterSheetVisible(false)}
      />

      {/* Same picker the Feed uses — opened from the header chip. Seeded at the
          current effective location so the pin starts where the user is looking. */}
      <LocationSheet
        visible={locationSheetVisible}
        initialLat={effectiveLocation.lat}
        initialLng={effectiveLocation.lng}
        onConfirm={handleLocationConfirm}
        onClose={() => setLocationSheetVisible(false)}
      />
    </View>
  );
}
