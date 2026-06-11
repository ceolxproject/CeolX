import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';
import type RNMapView from 'react-native-maps';
import MapView, { PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePlaceSearch } from '@/hooks/use-place-search';
import { getDeviceLocation } from '@/utils/device-location';
import { type GeocodeResult, reverseGeocode } from '@/utils/geocode';

const ZOOM = { latitudeDelta: 0.5, longitudeDelta: 0.5 };
const REVERSE_GEOCODE_DEBOUNCE_MS = 400;
const FALLBACK_LABEL = 'Selected location';

export interface FeedLocationSheetProps {
  visible: boolean;
  /** Map centre when the sheet opens — the feed's current effective location. */
  initialLat: number;
  initialLng: number;
  /** User confirmed a location. */
  onConfirm: (loc: { lat: number; lng: number; label: string }) => void;
  onClose: () => void;
}

export function FeedLocationSheet({
  visible,
  initialLat,
  initialLng,
  onConfirm,
  onClose,
}: FeedLocationSheetProps) {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<RNMapView>(null);
  const centreRef = useRef({ lat: initialLat, lng: initialLng });
  const [label, setLabel] = useState(FALLBACK_LABEL);
  const reverseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // When a search/recenter sets the centre programmatically we keep that label and
  // skip the next reverse-geocode pass (the animation also fires onRegionChange).
  const labelLockedRef = useRef(false);
  const reverseReqIdRef = useRef(0);

  const {
    query,
    suggestions,
    isDropdownVisible,
    isSearching,
    hasError,
    onChangeText,
    commitSelection,
    clearSearch,
    dismissDropdown,
  } = usePlaceSearch();

  // Reset the pin + label to the incoming location each time the sheet opens.
  useEffect(() => {
    if (!visible) return;
    centreRef.current = { lat: initialLat, lng: initialLng };
    setLabel(FALLBACK_LABEL);
    labelLockedRef.current = false;
    clearSearch();
  }, [visible, initialLat, initialLng, clearSearch]);

  useEffect(() => {
    return () => {
      if (reverseTimer.current) clearTimeout(reverseTimer.current);
    };
  }, []);

  const scheduleReverseGeocode = useCallback((lat: number, lng: number) => {
    if (reverseTimer.current) clearTimeout(reverseTimer.current);
    const reqId = ++reverseReqIdRef.current;
    reverseTimer.current = setTimeout(() => {
      void reverseGeocode(lat, lng).then((addr) => {
        if (addr && reqId === reverseReqIdRef.current) setLabel(addr);
      });
    }, REVERSE_GEOCODE_DEBOUNCE_MS);
  }, []);

  const handleRegionChangeComplete = useCallback(
    (region: Region) => {
      centreRef.current = { lat: region.latitude, lng: region.longitude };
      if (labelLockedRef.current) {
        // This change came from a programmatic animate (search/recenter); keep the
        // label we already set and re-enable reverse-geocoding for the next pan.
        labelLockedRef.current = false;
        return;
      }
      dismissDropdown();
      scheduleReverseGeocode(region.latitude, region.longitude);
    },
    [dismissDropdown, scheduleReverseGeocode]
  );

  const recentreTo = useCallback((lat: number, lng: number, nextLabel: string) => {
    // Invalidate any pending/in-flight reverse-geocode so it can't clobber this label.
    reverseReqIdRef.current++;
    if (reverseTimer.current) clearTimeout(reverseTimer.current);
    centreRef.current = { lat, lng };
    setLabel(nextLabel);
    if (!mapRef.current) return;
    // Lock only when we actually animate — the animation will fire
    // onRegionChangeComplete, which releases the lock and keeps this label.
    labelLockedRef.current = true;
    mapRef.current.animateToRegion({ latitude: lat, longitude: lng, ...ZOOM }, 600);
  }, []);

  const handleSelect = useCallback(
    (result: GeocodeResult) => {
      commitSelection(result.address);
      recentreTo(result.lat, result.lng, result.address);
    },
    [commitSelection, recentreTo]
  );

  const handleUseCurrentLocation = useCallback(async () => {
    const loc = await getDeviceLocation();
    if (loc) recentreTo(loc.lat, loc.lng, 'Current Location');
  }, [recentreTo]);

  const handleConfirm = useCallback(() => {
    const { lat, lng } = centreRef.current;
    onConfirm({ lat, lng, label });
    onClose();
  }, [label, onConfirm, onClose]);

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
          <Text className="text-lg font-bold text-white font-urbanist">
            Search events by location
          </Text>
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
              placeholder="Search a town, city or venue…"
              placeholderTextColor="#8D8D8D"
              value={query}
              onChangeText={onChangeText}
              returnKeyType="search"
              autoCorrect={false}
            />
            {isSearching && <ActivityIndicator size="small" color="#8D8D8D" />}
          </View>

          {/* Suggestions dropdown */}
          {isDropdownVisible && (
            <View
              className="absolute left-5 right-5 top-[60px] bg-white rounded-2xl overflow-hidden shadow-lg"
              style={{ elevation: 8 }}
            >
              {hasError ? (
                <Text className="px-4 py-3 text-[13px] text-[#8D8D8D] font-urbanist">
                  Couldn't search places. Check your connection.
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

          {/* Fixed centre pin overlay — non-interactive so map gestures pass through. */}
          <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
            <Ionicons
              name="location-sharp"
              size={40}
              color="#662FFF"
              style={{ marginBottom: 40 }}
            />
          </View>

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
              Set location · show events here
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
