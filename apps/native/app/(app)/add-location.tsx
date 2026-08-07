import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, TextInput, View } from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IRELAND_INITIAL_REGION } from '@CeolX/shared';

import { appToast } from '@/components/AppToast';
import { MapCentrePin } from '@/components/MapCentrePin';
import { useLocationOverride } from '@/contexts/location-override-context';
import { useLocationPickerMap } from '@/hooks/use-location-picker-map';
import { useMe } from '@/hooks/use-me';
import { setBaseLocation } from '@/utils/base-location';

/**
 * "Add your Location" (Figma 1:4479). Reached from the location priming screen's
 * "Select location manually" link. The chosen place becomes the user's persisted
 * base location (used when GPS is unavailable) and is also set as the session
 * override for instant effect on the map/feed.
 */
export default function AddLocationScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { setOverride } = useLocationOverride();
  const { data: me } = useMe();

  const initialLat = IRELAND_INITIAL_REGION.latitude;
  const initialLng = IRELAND_INITIAL_REGION.longitude;

  const {
    mapRef,
    label,
    query,
    suggestions,
    isDropdownVisible,
    isSearching,
    hasError,
    onChangeText,
    handleRegionChangeComplete,
    handleSelect,
    clearQuery,
    getCentre,
    resolveLabelForCentre,
    ZOOM,
  } = useLocationPickerMap(initialLat, initialLng);

  const [isSaving, setIsSaving] = useState(false);

  // me?.image is the OAuth avatar only; uploaded profile images aren't surfaced here.
  // The pin glyph fallback covers accounts without an OAuth avatar.
  const avatarUrl = me?.image ?? null;

  const handleSave = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    const { lat, lng } = getCentre();
    // Resolved against the pin's current position, not the debounced label — panning
    // and saving straight away would otherwise persist the previous place's address.
    // Still falls back to the generic label when the user never moved the map.
    const loc = { lat, lng, label: await resolveLabelForCentre() };
    try {
      await setBaseLocation(loc);
    } catch {
      setIsSaving(false);
      appToast.error('Could not save location', 'Please try again.');
      return; // nothing persisted → do NOT navigate or set the override
    }
    // This is the user's persisted base location — the saved/default, not a
    // temporary search.
    setOverride(loc, 'saved');
    router.back();
  }, [isSaving, getCentre, resolveLabelForCentre, setOverride, router]);

  return (
    <View className="flex-1 bg-black" style={{ paddingTop: insets.top }}>
      {/* Header: back button above the title (black area above the search) */}
      <View className="px-4 pt-2">
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          className="h-12 w-12 items-center justify-center rounded-full bg-black/60 active:opacity-70"
        >
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </Pressable>
        <Text className="ml-1 mt-3 font-urbanist text-[32px] font-semibold text-white">
          Add your Location
        </Text>
      </View>

      {/* Search field */}
      <View className="z-10 px-4 pt-4">
        <View className="h-12 flex-row items-center gap-3 rounded-full bg-white px-4">
          <Ionicons name="search" size={20} color="#8D8D8D" />
          <TextInput
            className="flex-1 font-urbanist text-[14px] text-black"
            style={{ padding: 0 }}
            placeholder="Search for province or county"
            placeholderTextColor="#8D8D8D"
            value={query}
            onChangeText={onChangeText}
            returnKeyType="search"
            autoCorrect={false}
          />
          {isSearching && <ActivityIndicator size="small" color="#8D8D8D" />}
          {query ? (
            <Pressable hitSlop={8} onPress={clearQuery} accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={18} color="#8D8D8D" />
            </Pressable>
          ) : null}
        </View>

        {isDropdownVisible && (
          <View
            className="absolute left-4 right-4 top-[64px] overflow-hidden rounded-2xl bg-white shadow-lg"
            style={{ elevation: 8 }}
          >
            {hasError ? (
              <Text className="px-4 py-3 font-urbanist text-[13px] text-[#8D8D8D]">
                Couldn&apos;t search places. Check your connection.
              </Text>
            ) : suggestions.length === 0 ? (
              <Text className="px-4 py-3 font-urbanist text-[13px] text-[#8D8D8D]">
                No places found.
              </Text>
            ) : (
              suggestions.map((result) => (
                <Pressable
                  key={`${result.lat},${result.lng}`}
                  className="flex-row items-center gap-3 px-4 py-3 active:bg-[#F5F5F5]"
                  onPress={() => handleSelect(result)}
                >
                  <View className="h-9 w-9 items-center justify-center rounded-full bg-[#F0F0F0]">
                    <Ionicons name="location-outline" size={20} color="#666" />
                  </View>
                  <Text className="flex-1 font-urbanist text-[14px] text-black" numberOfLines={2}>
                    {result.address}
                  </Text>
                </Pressable>
              ))
            )}
          </View>
        )}
      </View>

      {/* Map + avatar centre pin */}
      <View className="mt-4 flex-1 overflow-hidden">
        <MapView
          ref={mapRef}
          style={{ flex: 1 }}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          initialRegion={{ latitude: initialLat, longitude: initialLng, ...ZOOM }}
          onRegionChangeComplete={handleRegionChangeComplete}
          userInterfaceStyle="dark"
        />

        <MapCentrePin avatarUrl={avatarUrl} color="#6155F5" />
      </View>

      {/* Result card */}
      <View
        className="absolute left-6 right-6 rounded-xl bg-white p-4"
        style={{ bottom: insets.bottom + 16, elevation: 8 }}
      >
        <View className="mb-4 flex-row items-center gap-3">
          <View className="h-9 w-9 items-center justify-center rounded bg-[#F0F0F0]">
            <Ionicons name="location" size={20} color="#6155F5" />
          </View>
          <Text
            className="flex-1 font-urbanist text-[16px] font-medium text-black"
            numberOfLines={1}
          >
            {label}
          </Text>
          <Ionicons name="location-outline" size={20} color="#6155F5" />
        </View>

        <View className="flex-row gap-3">
          <Pressable
            onPress={() => router.back()}
            className="h-10 flex-1 items-center justify-center rounded-full border border-black active:opacity-70"
          >
            <Text className="font-urbanist text-[14px] font-semibold text-black">CANCEL</Text>
          </Pressable>
          <Pressable
            onPress={handleSave}
            disabled={isSaving}
            className="h-10 flex-1 items-center justify-center rounded-full bg-[#6155F5] active:opacity-70"
            style={isSaving ? { opacity: 0.6 } : undefined}
          >
            <Text className="font-urbanist text-[14px] font-semibold text-white">SAVE</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
