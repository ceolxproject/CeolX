import type GorhomBottomSheet from '@gorhom/bottom-sheet';
import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Text, View } from 'react-native';
import MapView from 'react-native-map-clustering';
import type { Region } from 'react-native-maps';
import { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

import { IRELAND_CENTER_LAT, IRELAND_CENTER_LNG } from '@CeolX/shared';

import { BottomSheet } from '@/components/BottomSheet';
import { EventPreviewCard } from '@/components/EventPreviewCard';
import { MapEventPin } from '@/components/MapEventPin';
import { useMapEvents } from '@/hooks/use-map-events';

// Category to emoji mapping for pin icons
const CATEGORY_ICONS: Record<string, string> = {
  Traditional: '🎻',
  Contemporary: '🎸',
  Fusion: '🎹',
  Celtic: '☘️',
  Folk: '🪕',
  Session: '🎵',
};

const IRELAND_INITIAL_REGION = {
  latitude: IRELAND_CENTER_LAT,
  longitude: IRELAND_CENTER_LNG,
  latitudeDelta: 4,
  longitudeDelta: 5,
};

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
  geometry: {
    coordinates: [number, number]; // [lng, lat]
  };
  properties: {
    point_count: number;
  };
  onPress: () => void;
};

export default function MapScreen() {
  const { events, isLoading, onRegionChangeComplete } = useMapEvents();
  const [selectedEvent, setSelectedEvent] = useState<MapEvent | null>(null);
  const [gpsGranted, setGpsGranted] = useState(false);
  // mapKey forces a remount when the GPS region resolves so initialRegion is applied.
  // (initialRegion is a mount-time-only prop on react-native-maps MapView)
  const [mapKey, setMapKey] = useState(0);
  const [initialRegion, setInitialRegion] = useState(IRELAND_INITIAL_REGION);
  const bottomSheetRef = useRef<GorhomBottomSheet>(null);

  // Try to get last known GPS location for initial map center
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
            latitudeDelta: 0.5,
            longitudeDelta: 0.5,
          });
          setMapKey((k) => k + 1); // trigger remount so initialRegion takes effect
        }
      } catch {
        // Silently fall back to Ireland center
      }
    })();
  }, []);

  const handleMarkerPress = useCallback((event: MapEvent) => {
    setSelectedEvent(event);
    bottomSheetRef.current?.snapToIndex(0);
  }, []);

  // Close the bottom sheet when the user pans so stale event previews are dismissed
  const handleRegionChangeComplete = useCallback(
    (region: Region) => {
      bottomSheetRef.current?.close();
      setSelectedEvent(null);
      onRegionChangeComplete(region);
    },
    [onRegionChangeComplete]
  );

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
    <View style={{ flex: 1, backgroundColor: '#080808' }}>
      <MapView
        key={mapKey}
        style={{ flex: 1 }}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={initialRegion}
        onRegionChangeComplete={handleRegionChangeComplete}
        showsUserLocation={gpsGranted}
        userInterfaceStyle={'dark' as const}
        // Clustering config
        clusterColor="#00B386"
        clusterTextColor="#080808"
        renderCluster={renderCluster}
      >
        {events.map((event) => (
          <Marker
            key={event.id}
            coordinate={{ latitude: event.lat, longitude: event.lng }}
            tracksViewChanges={false}
            onPress={() => handleMarkerPress(event)}
          >
            <MapEventPin type="single" categoryIcon={CATEGORY_ICONS[event.category]} />
          </Marker>
        ))}
      </MapView>

      {/* Loading overlay */}
      {isLoading && (
        <ActivityIndicator
          style={{ position: 'absolute', alignSelf: 'center', top: 24 }}
          size="large"
          color="#00B386"
        />
      )}

      {/* Empty state */}
      {!isLoading && events.length === 0 && (
        <View
          style={{
            position: 'absolute',
            bottom: 100,
            alignSelf: 'center',
            backgroundColor: 'rgba(43,43,43,0.92)',
            paddingHorizontal: 20,
            paddingVertical: 10,
            borderRadius: 20,
          }}
        >
          <Text style={{ color: '#ffffff', fontSize: 14 }}>No events in this area</Text>
        </View>
      )}

      {/* Event preview bottom sheet */}
      <BottomSheet ref={bottomSheetRef} snapPoints={['35%', '65%']}>
        {selectedEvent ? <EventPreviewCard event={selectedEvent} /> : null}
      </BottomSheet>
    </View>
  );
}
