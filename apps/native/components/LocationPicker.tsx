import { Ionicons } from '@expo/vector-icons';
import { cn } from 'heroui-native';
import { useRef } from 'react';
import { ActivityIndicator, Keyboard, Pressable, Text, TextInput, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { usePlaceSearch } from '@/hooks/use-place-search';
import { type GeocodeResult, reverseGeocode } from '@/utils/geocode';

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
  // Live place/venue autocomplete — same engine the map screen and Feed/Add
  // Location sheets use, so the onboarding search behaves consistently with
  // the rest of the app (type → debounced suggestions → tap to pin).
  const {
    query,
    suggestions,
    isSearching,
    isDropdownVisible,
    hasError,
    onChangeText,
    commitSelection,
  } = usePlaceSearch();

  const hasPin = lat !== null && lng !== null;

  // Reverse geocode to a readable label, falling back to the raw coordinates so
  // the address is never empty once a pin exists (the DB column is NOT NULL).
  // Goes through the server (Google) rather than the native geocoder, which
  // fails when device location services are off.
  const resolveAddress = async (latitude: number, longitude: number): Promise<string> => {
    const label = await reverseGeocode(latitude, longitude);
    return label ?? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
  };

  const commit = async (latitude: number, longitude: number, label?: string) => {
    const resolved = label ?? (await resolveAddress(latitude, longitude));
    onChange({ lat: latitude, lng: longitude, address: resolved });
  };

  // Picking a suggestion already gives us coordinates + a formatted address, so
  // pin it directly (no second geocode round-trip) and fly the map there.
  const handleSelect = (result: GeocodeResult) => {
    Keyboard.dismiss();
    commitSelection(result.address);
    mapRef.current?.animateToRegion(
      { latitude: result.lat, longitude: result.lng, ...PIN_DELTA },
      400
    );
    onChange({ lat: result.lat, lng: result.lng, address: result.address });
  };

  return (
    <View className="gap-2">
      {/* Search — relative+z so the absolute suggestions card overlays the map below. */}
      <View className="relative z-10">
        <View className="flex-row items-center rounded-lg border bg-surface px-3 py-2.5 gap-2 border-gray-8">
          <Ionicons name="search-outline" size={16} color="#8d8d8d" />
          <TextInput
            className="flex-1 text-[14px] text-white font-urbanist"
            placeholder={searchPlaceholder}
            placeholderTextColor="#8d8d8d"
            value={query}
            onChangeText={onChangeText}
            returnKeyType="search"
            autoCorrect={false}
          />
          {isSearching ? <ActivityIndicator size="small" color="#6C63FF" /> : null}
        </View>

        {/* Live suggestions — mirrors the Feed/Add Location dropdown. */}
        {isDropdownVisible ? (
          <View
            accessibilityRole="list"
            accessibilityLabel="Place suggestions"
            className="absolute left-0 right-0 top-[52px] bg-white rounded-2xl overflow-hidden shadow-lg"
            style={{ elevation: 8 }}
          >
            {hasError ? (
              <Text className="px-4 py-3 text-[13px] text-[#8D8D8D] font-urbanist">
                Couldn&apos;t search places. Check your connection.
              </Text>
            ) : suggestions.length === 0 ? (
              <View className="flex-row items-center px-4 py-3 gap-3">
                {isSearching ? (
                  <>
                    <ActivityIndicator size="small" color="#8D8D8D" />
                    <Text className="text-[14px] text-[#8D8D8D] font-urbanist">Searching…</Text>
                  </>
                ) : (
                  <Text className="text-[14px] text-[#8D8D8D] font-urbanist">
                    No places found — try a town or county.
                  </Text>
                )}
              </View>
            ) : (
              suggestions.map((result) => (
                <Pressable
                  key={`${result.lat},${result.lng},${result.address}`}
                  accessibilityRole="button"
                  accessibilityLabel={result.address}
                  className="flex-row items-center px-4 py-3 gap-3 active:bg-[#F5F5F5]"
                  onPress={() => handleSelect(result)}
                >
                  <View className="w-9 h-9 rounded-full bg-[#F0F0F0] items-center justify-center">
                    <Ionicons name="location-outline" size={20} color="#666" />
                  </View>
                  <Text
                    className="flex-1 text-[14px] text-[#1A1A1A] font-urbanist"
                    numberOfLines={2}
                  >
                    {result.address}
                  </Text>
                </Pressable>
              ))
            )}
          </View>
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
