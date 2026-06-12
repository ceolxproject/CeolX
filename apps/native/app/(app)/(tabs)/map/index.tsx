import * as Sentry from '@sentry/react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Modal, Platform, Text, View } from 'react-native';
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

import { appToast } from '@/components/AppToast';
import { EventPreviewCard } from '@/components/EventPreviewCard';
import { FilterSheet } from '@/components/FilterSheet';
import type { FilterSection } from '@/components/FilterSheet';
import { LocationBanner } from '@/components/LocationBanner';
import { LocationPermissionScreen } from '@/components/LocationPermissionScreen';
import type { ClusterObject } from '@/components/MapClusterMarker';
import { MapClusterMarker } from '@/components/MapClusterMarker';
import { MapEmptyStateCard } from '@/components/MapEmptyStateCard';
import { MapErrorBoundary } from '@/components/MapErrorBoundary';
import type { MapEvent } from '@/components/MapEventMarker';
import { MapEventMarker } from '@/components/MapEventMarker';
import { MapHeader } from '@/components/MapHeader';
import { MapOverlappingEventsSheet } from '@/components/MapOverlappingEventsSheet';
import { MapSearchBar } from '@/components/MapSearchBar';
import { PlaceSuggestionsDropdown } from '@/components/PlaceSuggestionsDropdown';
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
import { usePanelAnimation } from '@/hooks/use-panel-animation';
import { usePlaceSearch } from '@/hooks/use-place-search';
import { useVenueFallback } from '@/hooks/use-venue-fallback';
import type { GeocodeResult } from '@/utils/geocode';

const MAP_FILTER_SECTIONS: FilterSection[] = [
  { key: 'category', label: 'Category', options: EVENT_CATEGORIES },
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
  const { promptState, focusSearchOnMount, markSeen } = useLocationPermissionPrompt();
  // Shared with the Feed tab — a manual place pick on either screen syncs here.
  const { override, setOverride } = useLocationOverride();
  const venueFallback = useVenueFallback();
  const { initialRegion, gpsPermissionGranted, locationSource, mapKey } = useGpsRegion(
    promptState === 'done',
    venueFallback
  );
  // A manual override wins over the GPS/IP region for where the map opens.
  const effectiveInitialRegion = resolveMapInitialRegion(override, initialRegion);
  const mapEventsResult = useMapEvents({
    // A manual override gives explicit coords immediately; otherwise only pass
    // coords once the location chain has resolved — prevents expand from firing
    // with the Ireland default before GPS/IP has a chance to run.
    centerLat: override
      ? override.lat
      : locationSource !== 'pending'
        ? initialRegion.latitude
        : undefined,
    centerLng: override
      ? override.lng
      : locationSource !== 'pending'
        ? initialRegion.longitude
        : undefined,
  });
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
  const {
    selectedItem: selectedEvent,
    panelAnim,
    markerJustPressedRef,
    selectItem,
    dismissPanel,
  } = usePanelAnimation<MapEvent>();
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [emptyCardDismissed, setEmptyCardDismissed] = useState(false);
  // Live map region (null until the first settle) — drives clustering. Fall back
  // to initialRegion so the first paint is already clustered.
  const [region, setRegion] = useState<Region | null>(null);
  // Events sharing (near-)identical coords that a cluster can't zoom apart.
  const [overlapEvents, setOverlapEvents] = useState<MapEvent[] | null>(null);

  // While a preview owns the bottom of the screen (single card or same-location
  // sheet), hide the tab bar + FAB so the overlay sits flush against the bottom.
  // Re-assert on focus and always restore on blur so it can't get stuck hidden
  // on another tab.
  const { setHidden: setTabBarHidden } = useTabBarVisibility();
  const isPreviewOpen = Boolean(selectedEvent || overlapEvents);
  useFocusEffect(
    useCallback(() => {
      setTabBarHidden(isPreviewOpen);
      return () => setTabBarHidden(false);
    }, [isPreviewOpen, setTabBarHidden])
  );

  const { clusters, supercluster } = useMapClusters(events, region ?? effectiveInitialRegion);

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
      return (
        <MapEventMarker
          key={event.id}
          event={event}
          isSelected={selectedEvent?.id === event.id}
          onSelect={selectItem}
        />
      );
    },
    [handleClusterPress, selectedEvent?.id, selectItem]
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
  } = usePlaceSearch();

  // Surface a place-search failure as a non-blocking toast. Pins are never
  // cleared on a failed search — the map keeps whatever it was showing.
  useEffect(() => {
    if (placeSearchError) {
      appToast.error("Couldn't search places", 'Check your connection and try again.');
    }
  }, [placeSearchError]);

  const handlePlaceSelect = useCallback(
    (result: GeocodeResult) => {
      if (!mapRef.current) return;
      // Town/neighbourhood-level zoom so nearby events are visible — a tighter
      // venue-level view would often land on an empty patch. The map settling
      // triggers onRegionChangeComplete → the viewport query loads events.
      mapRef.current.animateToRegion(
        {
          latitude: result.lat,
          longitude: result.lng,
          latitudeDelta: 0.15,
          longitudeDelta: 0.15,
        },
        800
      );
      commitSelection(result.address);
      // Sync this intentional pick to the Feed. Mark it as already-applied so the
      // focus effect doesn't animate to the same spot again on the next focus.
      lastAppliedOverrideRef.current = `${result.lat},${result.lng}`;
      setOverride({ lat: result.lat, lng: result.lng, label: result.address });
    },
    [commitSelection, setOverride]
  );

  // Feed → Map: when the shared override changes (e.g. set from the Feed's
  // location sheet) and differs from what we last centred on, recentre on focus.
  // Free panning never writes the override, so this only fires for deliberate
  // picks. Guarded by the ref so re-focusing without a change is a no-op.
  useFocusEffect(
    useCallback(() => {
      if (!override) return;
      const key = `${override.lat},${override.lng}`;
      if (lastAppliedOverrideRef.current === key) return;
      lastAppliedOverrideRef.current = key;
      mapRef.current?.animateToRegion(
        {
          latitude: override.lat,
          longitude: override.lng,
          latitudeDelta: 0.15,
          longitudeDelta: 0.15,
        },
        600
      );
    }, [override])
  );

  const handleRegionChangeComplete = useCallback(
    (nextRegion: Region) => {
      if (!markerJustPressedRef.current) dismissPanel();
      setRegion(nextRegion);
      onRegionChangeComplete(nextRegion);
    },
    [onRegionChangeComplete, dismissPanel, markerJustPressedRef]
  );

  const handleMapPress = useCallback(() => {
    dismissDropdown();
    if (!markerJustPressedRef.current) dismissPanel();
  }, [dismissDropdown, dismissPanel, markerJustPressedRef]);

  if (promptState === 'checking') return null;
  if (promptState === 'show') {
    // navigationBarTranslucent draws the modal window edge-to-edge under the
    // Android nav bar; the sheet then pads itself by `insets.bottom` (passed in
    // from the activity above) to clear it. Passing insets avoids the modal's
    // own SafeAreaProvider, which reports bottom = 0 here.
    return (
      <Modal visible animationType="none" statusBarTranslucent navigationBarTranslucent>
        <LocationPermissionScreen onDone={markSeen} insets={insets} />
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
          onRegionChangeComplete={handleRegionChangeComplete}
          onPress={handleMapPress}
          showsUserLocation={Boolean(gpsPermissionGranted)}
          userInterfaceStyle={'dark' as const}
        >
          {clusters.map(renderMarker)}
        </MapView>
      </MapErrorBoundary>

      <MapHeader />
      <MapSearchBar
        value={searchText}
        onChangeText={onPlaceChangeText}
        onFilterPress={() => setFilterSheetVisible(true)}
        activeFilterCount={activeFilterCount}
        autoFocus={focusSearchOnMount}
      />

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
          style={{ position: 'absolute', alignSelf: 'center', top: 24 }}
          size="large"
          color="#6155F5"
        />
      )}

      {!isLoading && expandExhausted && !emptyCardDismissed && (
        <MapEmptyStateCard
          onDismiss={() => setEmptyCardDismissed(true)}
          onBrowseAll={() => router.push('/(app)/(tabs)/discover')}
        />
      )}

      {!isLoading && isError && !expandExhausted && (
        <View className="absolute bottom-[100px] self-center z-10 bg-[rgba(43,43,43,0.95)] px-5 py-4 rounded-2xl max-w-[300px]">
          <Text className="text-white text-[14px] text-center">
            Could not load events. Check your connection and try again.
          </Text>
        </View>
      )}

      {selectedEvent && !isDropdownVisible && (
        <Animated.View
          // The tab bar is hidden while this card is open, so it sits just above
          // the safe-area bottom instead of clearing the (now absent) bar.
          className="absolute left-4 right-4"
          style={{ bottom: insets.bottom + 16, transform: [{ translateY: panelAnim }] }}
        >
          <EventPreviewCard event={selectedEvent} onDismiss={dismissPanel} />
        </Animated.View>
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
    </View>
  );
}
