import * as Sentry from '@sentry/react-native';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Modal, Platform, Text, View } from 'react-native';
import MapView from 'react-native-map-clustering';
import type RNMapView from 'react-native-maps';
import type { Region } from 'react-native-maps';
import { PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EVENT_CATEGORIES, IRISH_COUNTIES, filterValidMapEvents } from '@CeolX/shared';

import { CountySuggestionsDropdown } from '@/components/CountySuggestionsDropdown';
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
import { MapSearchBar } from '@/components/MapSearchBar';
import type { CountyResult } from '@/hooks/use-county-search';
import { useCountySearch } from '@/hooks/use-county-search';
import { useGpsRegion } from '@/hooks/use-gps-region';
import { useLocationPermissionPrompt } from '@/hooks/use-location-permission-prompt';
import { useMapEvents } from '@/hooks/use-map-events';
import { usePanelAnimation } from '@/hooks/use-panel-animation';

const MAP_FILTER_SECTIONS: FilterSection[] = [
  { key: 'category', label: 'Category', options: EVENT_CATEGORIES },
  { key: 'county', label: 'County', options: IRISH_COUNTIES },
];

export default function MapScreen() {
  const mapRef = useRef<RNMapView>(null);
  const router = useRouter();
  // Read insets HERE (inside the root SafeAreaProvider), where they're measured
  // correctly. The permission Modal renders in a separate native window whose
  // own SafeAreaProvider reports bottom = 0 on Android, so we pass these
  // known-good values into it rather than letting it re-measure.
  const insets = useSafeAreaInsets();
  const { promptState, markSeen } = useLocationPermissionPrompt();
  const { initialRegion, gpsPermissionGranted, locationSource, mapKey } = useGpsRegion(
    promptState === 'done'
  );
  const mapEventsResult = useMapEvents({
    // Only pass coords once the location chain has resolved — prevents expand
    // from firing with the Ireland default before GPS/IP has a chance to run.
    centerLat: locationSource !== 'pending' ? initialRegion.latitude : undefined,
    centerLng: locationSource !== 'pending' ? initialRegion.longitude : undefined,
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
    onSearch,
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

  const showBanner = !bannerDismissed && (locationSource === 'ip' || locationSource === 'default');
  const bannerMessage =
    locationSource === 'ip'
      ? 'Using approximate location — search to refine.'
      : 'Could not determine your location. Search for a county or city.';

  const {
    query: searchText,
    suggestions,
    isDropdownVisible,
    onChangeText: onCountyChangeText,
    dismissDropdown,
    commitSelection,
  } = useCountySearch();

  const handleSearchChangeText = useCallback(
    (text: string) => {
      onCountyChangeText(text);
      onSearch(text);
    },
    [onCountyChangeText, onSearch]
  );

  const handleCountySelect = useCallback(
    (result: CountyResult) => {
      if (!mapRef.current) return;
      mapRef.current.animateToRegion(
        {
          latitude: result.centre.lat,
          longitude: result.centre.lng,
          latitudeDelta: 0.5,
          longitudeDelta: 0.5,
        },
        800
      );
      // Clear Typesense text filter so the viewport query returns all events
      // in the new region, then keep the picked county name visible in the bar.
      onSearch('');
      commitSelection(result.name);
    },
    [onSearch, commitSelection]
  );

  const handleRegionChangeComplete = useCallback(
    (region: Region) => {
      if (!markerJustPressedRef.current) dismissPanel();
      onRegionChangeComplete(region);
    },
    [onRegionChangeComplete, dismissPanel, markerJustPressedRef]
  );

  const handleMapPress = useCallback(() => {
    dismissDropdown();
    if (!markerJustPressedRef.current) dismissPanel();
  }, [dismissDropdown, dismissPanel, markerJustPressedRef]);

  const renderCluster = useCallback(
    (cluster: ClusterObject) => (
      <MapClusterMarker key={`cluster-${cluster.id}`} cluster={cluster} />
    ),
    []
  );

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
          initialRegion={initialRegion}
          onRegionChangeComplete={handleRegionChangeComplete}
          onPress={handleMapPress}
          showsUserLocation={Boolean(gpsPermissionGranted)}
          userInterfaceStyle={'dark' as const}
          clusterColor="#6155F5"
          clusterTextColor="#ffffff"
          renderCluster={renderCluster}
        >
          {events.map((event) => (
            <MapEventMarker
              key={event.id}
              event={event}
              isSelected={selectedEvent?.id === event.id}
              onSelect={selectItem}
            />
          ))}
        </MapView>
      </MapErrorBoundary>

      <MapHeader />
      <MapSearchBar
        value={searchText}
        onChangeText={handleSearchChangeText}
        onFilterPress={() => setFilterSheetVisible(true)}
        activeFilterCount={activeFilterCount}
      />

      {showBanner && (
        <LocationBanner message={bannerMessage} onDismiss={() => setBannerDismissed(true)} />
      )}

      {isDropdownVisible && (
        <CountySuggestionsDropdown suggestions={suggestions} onSelect={handleCountySelect} />
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
          className="absolute bottom-[90px] left-4 right-4"
          style={{ transform: [{ translateY: panelAnim }] }}
        >
          <EventPreviewCard event={selectedEvent} onDismiss={dismissPanel} />
        </Animated.View>
      )}

      <FilterSheet
        visible={filterSheetVisible}
        filters={filters}
        sections={MAP_FILTER_SECTIONS}
        variant="light"
        onApply={(f) => setFilters(f)}
        onClose={() => setFilterSheetVisible(false)}
      />
    </View>
  );
}
