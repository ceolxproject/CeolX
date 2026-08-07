import { Ionicons } from '@expo/vector-icons';
import { cn } from 'heroui-native';
import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';

import { LocationSheet } from '@/components/LocationSheet';
import { MapCentrePin } from '@/components/MapCentrePin';

const IRELAND_CENTER = { latitude: 53.1424, longitude: -7.6921 };
const PREVIEW_DELTA = { latitudeDelta: 0.02, longitudeDelta: 0.02 };

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
 * Location field for forms — the single source of truth for a venue/event location
 * across onboarding, profile edit and event creation.
 *
 * Shows a read-only preview and opens {@link LocationSheet} to change it. The map
 * here is deliberately inert: it previously accepted taps to place the pin, which
 * (a) fought the surrounding scroll view for the gesture and (b) could not move the
 * pin until a reverse-geocode round-trip returned, so users tapped repeatedly and
 * whichever response landed last won. Picking happens full-screen now, where the
 * pin is fixed to the map centre and moves with the pan.
 */
export function LocationPicker({
  lat,
  lng,
  address,
  onChange,
  error,
  searchPlaceholder,
}: LocationPickerProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const hasPin = lat !== null && lng !== null;

  return (
    <View className="gap-2">
      <Pressable
        onPress={() => setSheetOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={hasPin ? 'Change event location' : 'Set event location'}
        className={cn(
          'h-[160px] rounded-xl overflow-hidden border',
          error ? 'border-error' : 'border-gray-8'
        )}
      >
        {/* pointerEvents none on the wrapper so the whole preview is one tap target — a
            MapView swallows touches on Android even with its gestures disabled. */}
        <View pointerEvents="none" className="flex-1">
          {hasPin ? (
            <>
              <MapView
                style={{ flex: 1 }}
                provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
                region={{ latitude: lat, longitude: lng, ...PREVIEW_DELTA }}
                scrollEnabled={false}
                zoomEnabled={false}
                rotateEnabled={false}
                pitchEnabled={false}
                toolbarEnabled={false}
                userInterfaceStyle="dark"
              />
              <MapCentrePin />
            </>
          ) : (
            <View className="flex-1 items-center justify-center bg-surface gap-2">
              <Ionicons name="map-outline" size={28} color="#8d8d8d" />
              <Text className="text-sm text-gray-7 font-urbanist">No location set</Text>
            </View>
          )}
        </View>
      </Pressable>

      <Pressable
        onPress={() => setSheetOpen(true)}
        className="flex-row items-center gap-1.5 self-start"
      >
        <Ionicons name="location-outline" size={14} color="#6C63FF" />
        <Text className="text-sm text-[#6C63FF] font-urbanist">
          {hasPin ? 'Change location' : 'Set location on map'}
        </Text>
      </Pressable>

      {hasPin ? (
        <View className="flex-row">
          <Text className="text-xs text-gray-7 font-urbanist">📍 </Text>
          <Text className="flex-1 text-xs text-gray-7 font-urbanist">
            {address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`}
          </Text>
        </View>
      ) : null}

      {error ? <Text className="text-xs text-error font-urbanist">{error}</Text> : null}

      <LocationSheet
        visible={sheetOpen}
        initialLat={lat ?? IRELAND_CENTER.latitude}
        initialLng={lng ?? IRELAND_CENTER.longitude}
        initialLabel={hasPin ? address : undefined}
        // With no pin yet the sheet opens on the Ireland fallback centre, which the
        // user never chose — make them position the map before it can be confirmed.
        requirePositioning={!hasPin}
        title="Set location"
        confirmLabel="Use this location"
        searchPlaceholder={searchPlaceholder}
        onConfirm={({ lat: pickedLat, lng: pickedLng, label }) =>
          onChange({ lat: pickedLat, lng: pickedLng, address: label })
        }
        onClose={() => setSheetOpen(false)}
      />
    </View>
  );
}
