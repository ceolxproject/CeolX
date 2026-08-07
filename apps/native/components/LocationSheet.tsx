import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MapCentrePin } from '@/components/MapCentrePin';
import { useLocationPickerMap } from '@/hooks/use-location-picker-map';

export interface LocationSheetProps {
  visible: boolean;
  /** Map centre when the sheet opens. */
  initialLat: number;
  initialLng: number;
  /**
   * Address already known for `initialLat/Lng`. Seeds the label so confirming
   * without panning returns the real address rather than the placeholder.
   */
  initialLabel?: string;
  /** User confirmed a location. */
  onConfirm: (loc: { lat: number; lng: number; label: string }) => void;
  onClose: () => void;
  /** Header title. Defaults to the feed wording; other hosts override it. */
  title?: string;
  /** Primary CTA label. Defaults to the feed wording. */
  confirmLabel?: string;
  searchPlaceholder?: string;
}

/**
 * Full-screen map location picker: a pin fixed at the centre, moved by panning the
 * map beneath it. Deliberately has no tap-to-place — see {@link MapCentrePin}.
 */
export function LocationSheet({
  visible,
  initialLat,
  initialLng,
  initialLabel,
  onConfirm,
  onClose,
  title = 'Search events by location',
  confirmLabel = 'Set location · show events here',
  searchPlaceholder = 'Search a town, city or venue…',
}: LocationSheetProps) {
  const insets = useSafeAreaInsets();
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
    handleUseCurrentLocation,
    clearQuery,
    reset,
    getCentre,
    resolveLabelForCentre,
    ZOOM,
  } = useLocationPickerMap(initialLat, initialLng);

  // Reset the pin + label to the incoming location each time the sheet opens.
  useEffect(() => {
    if (!visible) return;
    reset(initialLat, initialLng, initialLabel || undefined);
  }, [visible, initialLat, initialLng, initialLabel, reset]);

  // Resolve the label against the pin's current position rather than trusting the
  // debounced one — panning and confirming straight away would otherwise save the
  // previously shown address against the new coordinates.
  const handleConfirm = useCallback(async () => {
    const { lat, lng } = getCentre();
    const resolved = await resolveLabelForCentre();
    onConfirm({ lat, lng, label: resolved });
    onClose();
  }, [getCentre, resolveLabelForCentre, onConfirm, onClose]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-[#1a1a1a]" style={{ paddingTop: insets.top + 8 }}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 py-3 border-b border-white/10">
          <Text className="text-lg font-bold text-white font-urbanist">{title}</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={24} color="#ffffff" />
          </Pressable>
        </View>

        {/* Search field */}
        <View className="px-5 pt-3 z-10">
          <View className="flex-row items-center bg-white rounded-xl h-12 px-4 gap-2">
            <Ionicons name="search" size={20} color="#8D8D8D" />
            <TextInput
              className="flex-1 text-[#1A1A1A] text-[14px]"
              style={{ padding: 0 }}
              placeholder={searchPlaceholder}
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

          {/* Suggestions dropdown */}
          {isDropdownVisible && (
            <View
              className="absolute left-5 right-5 top-[60px] bg-white rounded-2xl overflow-hidden shadow-lg"
              style={{ elevation: 8 }}
            >
              {hasError ? (
                <Text className="px-4 py-3 text-[13px] text-[#8D8D8D] font-urbanist">
                  Couldn&apos;t search places. Check your connection.
                </Text>
              ) : suggestions.length === 0 ? (
                <Text className="px-4 py-3 text-[13px] text-[#8D8D8D] font-urbanist">
                  No places found.
                </Text>
              ) : (
                suggestions.map((result) => (
                  <Pressable
                    key={`${result.lat},${result.lng}`}
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
          )}
        </View>

        {/* Map + centre pin */}
        <View className="flex-1 mt-3 overflow-hidden">
          <MapView
            ref={mapRef}
            style={{ flex: 1 }}
            provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
            initialRegion={{ latitude: initialLat, longitude: initialLng, ...ZOOM }}
            onRegionChangeComplete={handleRegionChangeComplete}
            userInterfaceStyle="dark"
          />

          <MapCentrePin />

          {/* Live address label */}
          <View pointerEvents="none" className="absolute top-3 left-4 right-4 items-center">
            <View className="bg-black/75 rounded-full px-3 py-1.5">
              <Text className="text-white text-[12px] font-urbanist" numberOfLines={1}>
                {label}
              </Text>
            </View>
          </View>

          {/* Recenter to GPS */}
          <Pressable
            onPress={handleUseCurrentLocation}
            className="absolute right-4 bottom-4 w-11 h-11 rounded-full bg-white items-center justify-center shadow-lg"
            style={{ elevation: 6 }}
          >
            <Ionicons name="locate" size={22} color="#1A1A1A" />
          </Pressable>
        </View>

        {/* Footer */}
        <View className="px-5 pt-3" style={{ paddingBottom: insets.bottom + 12 }}>
          <Pressable
            onPress={handleConfirm}
            className="h-12 rounded-full bg-[#C8FF2F] items-center justify-center"
          >
            <Text className="text-black text-[15px] font-semibold font-urbanist">
              {confirmLabel}
            </Text>
          </Pressable>
          <Pressable
            onPress={handleUseCurrentLocation}
            className="h-10 items-center justify-center mt-1"
          >
            <Text className="text-[#C8FF2F] text-[13px] font-semibold font-urbanist">
              Use my current location
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
