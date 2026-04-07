import { Ionicons } from '@expo/vector-icons';
import type GorhomBottomSheet from '@gorhom/bottom-sheet';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView from 'react-native-map-clustering';
import type { Region } from 'react-native-maps';
import { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IRELAND_CENTER_LAT, IRELAND_CENTER_LNG } from '@CeolX/shared';

import { BottomSheet } from '@/components/BottomSheet';
import { EventPreviewCard } from '@/components/EventPreviewCard';
import { MapEventPin } from '@/components/MapEventPin';
import { useMapEvents } from '@/hooks/use-map-events';

const CATEGORY_LABELS: Record<string, string> = {
  Traditional: 'Traditional session',
  Contemporary: 'Contemporary',
  Fusion: 'Fusion',
  Celtic: 'Celtic',
  Folk: 'Folk',
  Session: 'Session',
};

const CATEGORY_ICONS: Record<string, string> = {
  Traditional: '🎵',
  Contemporary: '🎸',
  Fusion: '🎹',
  Celtic: '☘️',
  Folk: '🪕',
  Session: '🎶',
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
  const [mapKey, setMapKey] = useState(0);
  const [initialRegion, setInitialRegion] = useState(IRELAND_INITIAL_REGION);
  const bottomSheetRef = useRef<GorhomBottomSheet>(null);
  const insets = useSafeAreaInsets();

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
          setMapKey((k) => k + 1);
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

  const handleBackPress = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(app)/(tabs)/discover');
    }
  }, []);

  // Overlay positions
  const headerTop = insets.top;
  const searchBarTop = headerTop + 52 + 8;

  return (
    <View style={styles.container}>
      {/* Full-screen map */}
      <MapView
        key={mapKey}
        style={StyleSheet.absoluteFill}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={initialRegion}
        onRegionChangeComplete={handleRegionChangeComplete}
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
            onPress={() => handleMarkerPress(event)}
          >
            <View style={styles.markerContainer}>
              <MapEventPin
                type="single"
                coverImageUrl={event.coverImageUrl}
                category={CATEGORY_LABELS[event.category] ?? event.category}
                categoryIcon={CATEGORY_ICONS[event.category]}
                isSelected={selectedEvent?.id === event.id}
              />
              {/* Inline label when selected */}
              {selectedEvent?.id === event.id ? (
                <View style={styles.inlineLabel}>
                  <Text style={styles.inlineLabelText} numberOfLines={1}>
                    {event.title}
                  </Text>
                </View>
              ) : null}
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Header overlay */}
      <View style={[styles.headerOverlay, { top: headerTop }]} pointerEvents="box-none">
        {/* Back button */}
        <Pressable style={styles.backButton} onPress={handleBackPress}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </Pressable>

        {/* Title */}
        <Text style={styles.headerTitle}>Find Event</Text>

        {/* Right spacer to balance the layout */}
        <View style={styles.headerSpacer} />
      </View>

      {/* Search bar overlay */}
      <View style={[styles.searchBarOverlay, { top: searchBarTop }]} pointerEvents="box-none">
        <View style={styles.searchPill} pointerEvents="none">
          <Ionicons name="search" size={20} color="#8D8D8D" />
          <Text style={styles.searchPlaceholder} numberOfLines={1}>
            Search by county / artist / category
          </Text>
          <View style={styles.filterButton}>
            <Ionicons name="options-outline" size={20} color="#8D8D8D" />
          </View>
        </View>
      </View>

      {/* Loading overlay */}
      {isLoading && (
        <ActivityIndicator style={styles.loadingIndicator} size="large" color="#6155F5" />
      )}

      {/* Empty state */}
      {!isLoading && events.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            No events near here. Try searching for Dublin, Galway, or Cork.
          </Text>
        </View>
      )}

      {/* Event preview bottom sheet */}
      <BottomSheet ref={bottomSheetRef} snapPoints={['35%', '65%']}>
        {selectedEvent ? <EventPreviewCard event={selectedEvent} /> : null}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080808',
  },
  markerContainer: {
    alignItems: 'center',
  },
  inlineLabel: {
    marginTop: 4,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    maxWidth: 140,
  },
  inlineLabelText: {
    fontSize: 11,
    color: '#080808',
    fontWeight: '600',
  },

  // Header overlay
  headerOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 60,
    backgroundColor: 'rgba(0,0,0,0.55)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '700',
    fontFamily: 'Urbanist_700Bold',
  },
  headerSpacer: {
    width: 48,
  },

  // Search bar overlay
  searchBarOverlay: {
    position: 'absolute',
    left: 16,
    right: 16,
  },
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 100,
    height: 44,
    paddingHorizontal: 16,
    gap: 8,
  },
  searchPlaceholder: {
    flex: 1,
    color: '#8D8D8D',
    fontSize: 14,
  },
  filterButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Loading
  loadingIndicator: {
    position: 'absolute',
    alignSelf: 'center',
    top: 24,
  },

  // Empty state
  emptyState: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    backgroundColor: 'rgba(43,43,43,0.92)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    maxWidth: 280,
  },
  emptyStateText: {
    color: '#ffffff',
    fontSize: 14,
    textAlign: 'center',
  },
});
