import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Platform, Pressable, Text, View } from 'react-native';
import MapView from 'react-native-map-clustering';
import type { Region } from 'react-native-maps';
import { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import type RNMapView from 'react-native-maps';

import { CATEGORY_ICONS, CATEGORY_LABELS } from '@CeolX/shared';

import { CountySuggestionsDropdown } from '@/components/CountySuggestionsDropdown';
import { EventPreviewCard } from '@/components/EventPreviewCard';
import { MapEventPin } from '@/components/MapEventPin';
import { MapFilterSheet } from '@/components/MapFilterSheet';
import { MapHeader } from '@/components/MapHeader';
import { MapSearchBar } from '@/components/MapSearchBar';
import type { CountyResult } from '@/hooks/use-county-search';
import { useCountySearch } from '@/hooks/use-county-search';
import { useGpsRegion } from '@/hooks/use-gps-region';
import { useMapEvents } from '@/hooks/use-map-events';
import { usePanelAnimation } from '@/hooks/use-panel-animation';

type MapEvent = {
  id: string;
  title: string;
  lat: number;
  lng: number;
  category: string;
  dateStart: string;
  dateEnd?: string;
  venueAddress?: string;
  coverImageUrl?: string;
  isGigOpportunity: boolean;
  distanceMeters?: number;
};

// Typed shape of the cluster object passed by react-native-map-clustering
type ClusterObject = {
  id: string | number;
  geometry: { coordinates: [number, number] }; // [lng, lat]
  properties: { point_count: number };
  onPress: () => void;
};

export default function MapScreen() {
  const mapRef = useRef<RNMapView>(null);
  const {
    events,
    isLoading,
    onRegionChangeComplete,
    onSearch,
    filters,
    setFilters,
    activeFilterCount,
  } = useMapEvents();
  const { initialRegion, gpsGranted, mapKey } = useGpsRegion();
  const {
    selectedItem: selectedEvent,
    panelAnim,
    markerJustPressedRef,
    selectItem,
    dismissPanel,
  } = usePanelAnimation<MapEvent>();
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);

  const {
    query: searchText,
    suggestions,
    isDropdownVisible,
    onChangeText: onCountyChangeText,
    dismissDropdown,
    clearSearch,
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
      dismissDropdown();
      clearSearch();
      mapRef.current?.animateToRegion(
        {
          latitude: result.centre.lat,
          longitude: result.centre.lng,
          latitudeDelta: 0.5,
          longitudeDelta: 0.5,
        },
        800
      );
    },
    [dismissDropdown, clearSearch]
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
  }, [dismissDropdown]);

  const renderCluster = useCallback(
    (cluster: ClusterObject) => (
      <Marker
        key={`cluster-${cluster.id}`}
        coordinate={{
          latitude: cluster.geometry.coordinates[1],
          longitude: cluster.geometry.coordinates[0],
        }}
        onPress={cluster.onPress}
      >
        <MapEventPin type="cluster" count={cluster.properties.point_count} />
      </Marker>
    ),
    []
  );

  return (
    <View className="flex-1 bg-[#080808]">
      {/* Full-screen map */}
      <MapView
        ref={mapRef}
        key={mapKey}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={initialRegion}
        onRegionChangeComplete={handleRegionChangeComplete}
        onPress={handleMapPress}
        showsUserLocation={gpsGranted}
        userInterfaceStyle={'dark' as const}
        clusterColor="#6155F5"
        clusterTextColor="#ffffff"
        renderCluster={renderCluster}
      >
        {events.map((event) => (
          <Marker
            key={event.id}
            coordinate={{ latitude: event.lat, longitude: event.lng }}
            tracksViewChanges={selectedEvent?.id === event.id}
          >
            <Pressable onPress={() => selectItem(event)}>
              <View className="items-center">
                <MapEventPin
                  type="single"
                  coverImageUrl={event.coverImageUrl}
                  category={CATEGORY_LABELS[event.category] ?? event.category}
                  categoryIcon={CATEGORY_ICONS[event.category]}
                  isSelected={selectedEvent?.id === event.id}
                />
                {selectedEvent?.id === event.id ? (
                  <View className="mt-1 bg-[rgba(255,255,255,0.92)] px-2 py-[3px] rounded-[10px] max-w-[140px]">
                    <Text className="text-[11px] text-[#080808] font-semibold" numberOfLines={1}>
                      {event.title}
                    </Text>
                  </View>
                ) : null}
              </View>
            </Pressable>
          </Marker>
        ))}
      </MapView>

      <MapHeader />
      <MapSearchBar
        value={searchText}
        onChangeText={handleSearchChangeText}
        onFilterPress={() => setFilterSheetVisible(true)}
        activeFilterCount={activeFilterCount}
      />

      {isDropdownVisible && (
        <CountySuggestionsDropdown
          suggestions={suggestions}
          onSelect={handleCountySelect}
        />
      )}

      {isLoading && (
        <ActivityIndicator
          style={{ position: 'absolute', alignSelf: 'center', top: 24 }}
          size="large"
          color="#6155F5"
        />
      )}

      {!isLoading && events.length === 0 && !isDropdownVisible && (
        <View className="absolute bottom-[100px] self-center bg-[rgba(43,43,43,0.92)] px-5 py-[10px] rounded-[20px] max-w-[280px]">
          <Text className="text-white text-[14px] text-center">
            No events near here. Try searching for Dublin, Galway, or Cork.
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

      <MapFilterSheet
        visible={filterSheetVisible}
        filters={filters}
        onApply={setFilters}
        onClose={() => setFilterSheetVisible(false)}
      />
    </View>
  );
}
