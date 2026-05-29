import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { cn } from 'heroui-native';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

const IRELAND_CENTER = { latitude: 53.1424, longitude: -7.6921 };
const IRELAND_DELTA = { latitudeDelta: 4, longitudeDelta: 4 };
const PIN_DELTA = { latitudeDelta: 0.05, longitudeDelta: 0.05 };

export type PickedLocation = { lat: number; lng: number; address: string };

interface LocationPickerProps {
  lat: number | null;
  lng: number | null;
  /** Human-readable label derived from the pin (search result / reverse geocode). */
  address: string;
  onChange: (location: PickedLocation) => void;
  error?: string;
  searchPlaceholder?: string;
}

/**
 * Map-based location picker — the single source of truth for a venue/event
 * location across onboarding, profile edit and event creation. The map pin
 * (lat/lng) is what every downstream feature uses (map screen, navigation,
 * event creation), so coordinates are always captured; the address string is
 * only a display label derived from the pin, never free-typed.
 */
export function LocationPicker({
  lat,
  lng,
  address,
  onChange,
  error,
  searchPlaceholder = 'Search city, county or venue name…',
}: LocationPickerProps) {
  const mapRef = useRef<MapView>(null);
  const [search, setSearch] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const hasPin = lat !== null && lng !== null;

  // Reverse geocode to a readable label, falling back to the raw coordinates so
  // the address is never empty once a pin exists (the DB column is NOT NULL).
  const resolveAddress = async (latitude: number, longitude: number): Promise<string> => {
    try {
      const results = await Location.reverseGeocodeAsync({ latitude, longitude });
      const r = results[0];
      if (r) {
        const label = [r.name, r.city ?? r.region, r.country].filter(Boolean).join(', ');
        if (label) return label;
      }
    } catch {
      // Reverse geocoding is best-effort — fall back to coordinates below.
    }
    return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
  };

  const commit = async (latitude: number, longitude: number, label?: string) => {
    const resolved = label ?? (await resolveAddress(latitude, longitude));
    onChange({ lat: latitude, lng: longitude, address: resolved });
  };

  const handleSearch = async () => {
    const query = search.trim();
    if (!query) return;
    setIsSearching(true);
    try {
      // Bias to Ireland — the app is Irish-music only.
      const results = await Location.geocodeAsync(`${query}, Ireland`);
      const first = results[0];
      if (first) {
        mapRef.current?.animateToRegion({ ...first, ...PIN_DELTA }, 400);
        const resolved = await resolveAddress(first.latitude, first.longitude);
        await commit(first.latitude, first.longitude, resolved || query);
      } else {
        Alert.alert('No results', `No location found for "${query}". Try a different search.`);
      }
    } catch {
      Alert.alert('Search failed', 'Could not search for that location. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <View className="gap-2">
      {/* Search */}
      <View className="flex-row items-center rounded-lg border bg-surface px-3 py-2.5 gap-2 border-gray-8">
        <Ionicons name="search-outline" size={16} color="#8d8d8d" />
        <TextInput
          className="flex-1 text-sm text-white font-urbanist"
          placeholder={searchPlaceholder}
          placeholderTextColor="#8d8d8d"
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          autoCorrect={false}
          onSubmitEditing={handleSearch}
        />
        {isSearching ? (
          <ActivityIndicator size="small" color="#6C63FF" />
        ) : search.length > 0 ? (
          <Pressable onPress={handleSearch} hitSlop={8}>
            <Ionicons name="arrow-forward-circle" size={20} color="#6C63FF" />
          </Pressable>
        ) : null}
      </View>

      {/* Map — explicit style: className alone doesn't reliably reach the native view. */}
      <View
        className={cn(
          'h-[220px] rounded-xl overflow-hidden border',
          error ? 'border-error' : 'border-gray-8'
        )}
      >
        <MapView
          ref={mapRef}
          style={{ flex: 1 }}
          initialRegion={
            hasPin
              ? { latitude: lat, longitude: lng, ...PIN_DELTA }
              : { ...IRELAND_CENTER, ...IRELAND_DELTA }
          }
          onPress={(e) => {
            const { latitude, longitude } = e.nativeEvent.coordinate;
            void commit(latitude, longitude);
          }}
        >
          {hasPin && (
            <Marker
              coordinate={{ latitude: lat, longitude: lng }}
              draggable
              onDragEnd={(e) => {
                const { latitude, longitude } = e.nativeEvent.coordinate;
                void commit(latitude, longitude);
              }}
            />
          )}
        </MapView>
      </View>

      <Text className="text-xs text-gray-7 font-urbanist">
        {hasPin
          ? `📍 ${address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`}`
          : 'Search above or tap the map to pin your location'}
      </Text>

      {error ? <Text className="text-xs text-error font-urbanist">{error}</Text> : null}
    </View>
  );
}
