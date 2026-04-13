import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { cn } from 'heroui-native';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { CalendarPickerModal } from '@/components/events/CalendarPickerModal';
import { TimePickerModal } from '@/components/events/TimePickerModal';
import { trpc } from '@/utils/trpc';

const IRELAND_CENTER = { latitude: 53.1424, longitude: -7.6921 };
const IRELAND_DELTA = { latitudeDelta: 4, longitudeDelta: 4 };

type Props = {
  dateStart: Date | null;
  onDateStartChange: (d: Date) => void;
  startTime: Date | null;
  onStartTimeChange: (d: Date) => void;
  endTime: Date | null;
  onEndTimeChange: (d: Date | null) => void;
  lat: number | null;
  lng: number | null;
  onLocationChange: (lat: number, lng: number) => void;
  venueAddress: string;
  onVenueAddressChange: (v: string) => void;
  /** Called with the selected registered venue's ID (empty string to clear). */
  onVenueIdChange: (id: string) => void;
  /** When true, show map+search instead of the registered venue dropdown. */
  showManualAddress: boolean;
  onToggleManualAddress: () => void;
  errors: Record<string, string>;
  onContinue: () => void;
  onBack: () => void;
  /** Registered venue address for "Use my venue" pre-fill (venue creators only) */
  myVenueAddress?: string | null;
  isVenue?: boolean;
  /** When true, skip auto-pre-fill (user is editing an existing event with its own location) */
  isEditing?: boolean;
};

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-IE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-IE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

// ─── Main step component ─────────────────────────────────────────────────────

export function DateVenueStep({
  dateStart,
  onDateStartChange,
  startTime,
  onStartTimeChange,
  endTime,
  onEndTimeChange,
  lat,
  lng,
  onLocationChange,
  venueAddress,
  onVenueAddressChange,
  onVenueIdChange,
  showManualAddress,
  onToggleManualAddress,
  errors,
  onContinue,
  onBack,
  myVenueAddress,
  isVenue,
  isEditing,
}: Props) {
  const mapRef = useRef<MapView>(null);

  // Picker visibility state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  // Map venue search
  const [venueSearch, setVenueSearch] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isPreFilling, setIsPreFilling] = useState(false);

  // Artist venue picker
  const [showVenueDropdown, setShowVenueDropdown] = useState(false);
  const [selectedVenueName, setSelectedVenueName] = useState('');
  const { data: registeredVenues = [], isLoading: isLoadingVenues } = useQuery(
    trpc.venues.list.queryOptions()
  );

  const reverseGeocode = async (latitude: number, longitude: number): Promise<string | null> => {
    try {
      const results = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (results.length > 0) {
        const r = results[0];
        const parts = [r.name, r.city ?? r.region, r.country].filter(Boolean);
        return parts.join(', ') || null;
      }
    } catch {
      // Silently fail — user can still use manual address entry
    }
    return null;
  };

  const handleVenueSearch = async () => {
    const query = venueSearch.trim();
    if (!query) return;
    setIsSearching(true);
    try {
      // Bias results to Ireland by appending country hint
      const results = await Location.geocodeAsync(`${query}, Ireland`);
      if (results.length > 0) {
        const { latitude, longitude } = results[0];
        mapRef.current?.animateToRegion(
          { latitude, longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 },
          400
        );
        onLocationChange(latitude, longitude);
        // Use search query as address label; reverse geocode for a cleaner result
        const resolved = await reverseGeocode(latitude, longitude);
        onVenueAddressChange(resolved ?? query);
      } else {
        Alert.alert('No results', `No location found for "${query}". Try a different search.`);
      }
    } catch {
      Alert.alert('Search failed', 'Could not search for that location. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleMapPress = async (latitude: number, longitude: number) => {
    onLocationChange(latitude, longitude);
    const resolved = await reverseGeocode(latitude, longitude);
    if (resolved) onVenueAddressChange(resolved);
  };

  const handleUseMyVenue = async () => {
    if (!myVenueAddress) return;
    setIsPreFilling(true);
    try {
      const results = await Location.geocodeAsync(`${myVenueAddress}, Ireland`);
      if (results.length > 0) {
        const { latitude, longitude } = results[0];
        onLocationChange(latitude, longitude);
        onVenueAddressChange(myVenueAddress);
        mapRef.current?.animateToRegion(
          { latitude, longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 },
          400
        );
      } else {
        // Geocoding failed — fall back to just setting the address text
        onVenueAddressChange(myVenueAddress);
        Alert.alert(
          'Could not locate address',
          "Your venue address was set but we couldn't find it on the map. You can adjust the pin manually."
        );
      }
    } catch {
      onVenueAddressChange(myVenueAddress);
    } finally {
      setIsPreFilling(false);
    }
  };

  // Auto-pre-fill venue address on create (not edit) when venue has a registered address
  useEffect(() => {
    if (!isVenue || !myVenueAddress || isEditing || lat !== null) return;
    void handleUseMyVenue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myVenueAddress]);

  return (
    <>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-10 gap-5"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Date ── */}
        <View className="gap-1.5">
          <Text className="text-sm font-semibold text-gray-3 font-urbanist">Date</Text>
          <Pressable
            className={cn(
              'flex-row items-center justify-between rounded-lg border px-4 py-3 bg-surface',
              errors.dateStart ? 'border-error' : 'border-gray-8'
            )}
            onPress={() => setShowDatePicker(true)}
          >
            <Text className={cn('text-sm font-urbanist', dateStart ? 'text-white' : 'text-gray-7')}>
              {dateStart ? formatDate(dateStart) : 'Select Date'}
            </Text>
            <Ionicons name="chevron-forward" size={16} color="#8d8d8d" />
          </Pressable>
          {errors.dateStart && (
            <Text className="text-xs text-error font-urbanist">{errors.dateStart}</Text>
          )}
        </View>

        {/* ── Time ── */}
        <View className="gap-1.5">
          <Text className="text-sm font-semibold text-gray-3 font-urbanist">Time</Text>
          <View className="flex-row gap-3">
            {/* Start Time */}
            <View className="flex-1 gap-1">
              <Pressable
                className={cn(
                  'flex-row items-center justify-between rounded-lg border px-4 py-3 bg-surface',
                  errors.startTime ? 'border-error' : 'border-gray-8'
                )}
                onPress={() => setShowStartTimePicker(true)}
              >
                <Text
                  className={cn('text-sm font-urbanist', startTime ? 'text-white' : 'text-gray-7')}
                >
                  {startTime ? formatTime(startTime) : 'Start Time'}
                </Text>
                <Ionicons name="chevron-forward" size={16} color="#8d8d8d" />
              </Pressable>
              {errors.startTime && (
                <Text className="text-xs text-error font-urbanist">{errors.startTime}</Text>
              )}
            </View>

            {/* End Time */}
            <View className="flex-1 gap-1">
              <Pressable
                className={cn(
                  'flex-row items-center justify-between rounded-lg border px-4 py-3 bg-surface',
                  errors.endTime ? 'border-error' : 'border-gray-8'
                )}
                onPress={() => setShowEndTimePicker(true)}
              >
                <Text
                  className={cn('text-sm font-urbanist', endTime ? 'text-white' : 'text-gray-7')}
                >
                  {endTime ? formatTime(endTime) : 'End Time'}
                </Text>
                <Ionicons name="chevron-forward" size={16} color="#8d8d8d" />
              </Pressable>
              {errors.endTime && (
                <Text className="text-xs text-error font-urbanist">{errors.endTime}</Text>
              )}
            </View>
          </View>
        </View>

        {/* ── Venue ── */}
        <View className="gap-1.5">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-semibold text-gray-3 font-urbanist">Choose Venue</Text>
            <Pressable onPress={onToggleManualAddress}>
              <Text className="text-xs font-bold text-[#C8FF2F] font-urbanist tracking-wide">
                {showManualAddress ? 'SELECT VENUE' : 'ENTER MANUALLY'}
              </Text>
            </Pressable>
          </View>

          {showManualAddress ? (
            /* Map + search mode — user pins a custom location */
            <View className="gap-2">
              <View className="flex-row items-center rounded-lg border bg-surface px-3 py-2.5 gap-2 border-gray-8">
                <Ionicons name="search-outline" size={16} color="#8d8d8d" />
                <TextInput
                  className="flex-1 text-sm text-white font-urbanist"
                  placeholder={
                    isVenue
                      ? 'Search city, county or venue name…'
                      : 'Search for performance location…'
                  }
                  placeholderTextColor="#8d8d8d"
                  value={venueSearch}
                  onChangeText={setVenueSearch}
                  returnKeyType="search"
                  autoCorrect={false}
                  onSubmitEditing={handleVenueSearch}
                />
                {isSearching ? (
                  <ActivityIndicator size="small" color="#6C63FF" />
                ) : venueSearch.length > 0 ? (
                  <Pressable onPress={handleVenueSearch} hitSlop={8}>
                    <Ionicons name="arrow-forward-circle" size={20} color="#6C63FF" />
                  </Pressable>
                ) : null}
              </View>

              {/* MapView requires explicit style — className alone doesn't
                  reliably reach the underlying native component. */}
              <View
                className={cn(
                  'h-[220px] rounded-xl overflow-hidden border',
                  errors.lat ? 'border-error' : 'border-gray-8'
                )}
              >
                <MapView
                  ref={mapRef}
                  className="flex-1"
                  style={{ flex: 1 }}
                  initialRegion={{ ...IRELAND_CENTER, ...IRELAND_DELTA }}
                  onPress={(e) => {
                    const { latitude, longitude } = e.nativeEvent.coordinate;
                    void handleMapPress(latitude, longitude);
                  }}
                >
                  {lat !== null && lng !== null && (
                    <Marker
                      coordinate={{ latitude: lat, longitude: lng }}
                      draggable
                      onDragEnd={(e) => {
                        const { latitude, longitude } = e.nativeEvent.coordinate;
                        void handleMapPress(latitude, longitude);
                      }}
                    />
                  )}
                </MapView>
              </View>

              <Text className="text-xs text-gray-7 font-urbanist">
                {lat !== null && lng !== null
                  ? `📍 ${venueAddress || `${lat.toFixed(5)}, ${lng.toFixed(5)}`}`
                  : 'Tap the map or search above to set a venue location'}
              </Text>

              {errors.lat && <Text className="text-xs text-error font-urbanist">{errors.lat}</Text>}
            </View>
          ) : (
            /* Default mode — pick from registered venues (artists) or own venue (venues) */
            <View className="gap-1.5">
              {!isVenue && (
                <View className="gap-1">
                  <Pressable
                    className="flex-row items-center justify-between rounded-lg border border-gray-8 bg-surface px-4 py-3"
                    onPress={() => setShowVenueDropdown((v) => !v)}
                  >
                    {isLoadingVenues ? (
                      <ActivityIndicator size="small" color="#8d8d8d" />
                    ) : (
                      <Text
                        className={cn(
                          'flex-1 text-sm font-urbanist',
                          selectedVenueName ? 'text-white' : 'text-gray-7'
                        )}
                      >
                        {selectedVenueName || 'Select a registered venue…'}
                      </Text>
                    )}
                    <Ionicons
                      name={showVenueDropdown ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color="#8d8d8d"
                    />
                  </Pressable>

                  {showVenueDropdown && (
                    <View className="rounded-lg border border-gray-8 bg-surface overflow-hidden">
                      {registeredVenues.length === 0 ? (
                        <View className="px-4 py-3">
                          <Text className="text-sm text-gray-7 font-urbanist">
                            No registered venues found
                          </Text>
                        </View>
                      ) : (
                        registeredVenues.map((v) => (
                          <Pressable
                            key={v.id}
                            className="px-4 py-3 active:bg-white/5 border-b border-gray-8"
                            onPress={async () => {
                              setShowVenueDropdown(false);
                              setSelectedVenueName(v.name);
                              onVenueAddressChange(v.address);
                              onVenueIdChange(v.id);
                              // Geocode to populate lat/lng for the event's spatial index
                              try {
                                const results = await Location.geocodeAsync(
                                  `${v.address}, Ireland`
                                );
                                if (results.length > 0) {
                                  const { latitude, longitude } = results[0];
                                  onLocationChange(latitude, longitude);
                                }
                              } catch {
                                // Geocoding failed — address is still set
                              }
                            }}
                          >
                            <Text className="text-sm font-semibold text-white font-urbanist">
                              {v.name}
                            </Text>
                            <Text className="text-xs text-gray-7 font-urbanist mt-0.5">
                              {v.address}
                            </Text>
                          </Pressable>
                        ))
                      )}
                    </View>
                  )}
                </View>
              )}

              {isVenue && myVenueAddress && venueAddress !== myVenueAddress && (
                <Pressable
                  className="flex-row items-center gap-2 rounded-lg border border-[#6C63FF]/40 bg-[#6C63FF]/10 px-3 py-2.5"
                  onPress={handleUseMyVenue}
                  disabled={isPreFilling}
                >
                  <Ionicons name="business-outline" size={16} color="#6C63FF" />
                  {isPreFilling ? (
                    <ActivityIndicator size="small" color="#6C63FF" />
                  ) : (
                    <Text className="flex-1 text-sm text-[#6C63FF] font-urbanist">
                      Reset to my venue
                    </Text>
                  )}
                  <Text className="shrink text-xs text-gray-7 font-urbanist" numberOfLines={1}>
                    {myVenueAddress}
                  </Text>
                </Pressable>
              )}

              {venueAddress ? (
                <Text className="text-xs text-gray-7 font-urbanist">📍 {venueAddress}</Text>
              ) : null}

              {errors.lat && <Text className="text-xs text-error font-urbanist">{errors.lat}</Text>}
            </View>
          )}
        </View>

        {/* ── Buttons ── */}
        <View className="flex-row gap-3 mt-2">
          <Pressable
            className="flex-1 items-center justify-center rounded-xl border border-white py-4"
            onPress={onBack}
          >
            <Text className="text-white font-bold text-base font-urbanist">BACK</Text>
          </Pressable>

          <Pressable
            className="flex-1 items-center justify-center rounded-xl bg-[#6C63FF] py-4"
            onPress={onContinue}
          >
            <Text className="text-white font-bold text-base font-urbanist">CONTINUE</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Date picker — custom calendar bottom sheet */}
      <CalendarPickerModal
        visible={showDatePicker}
        value={dateStart}
        minimumDate={new Date()}
        onSelect={(date) => {
          onDateStartChange(date);
          setShowDatePicker(false);
        }}
        onClose={() => setShowDatePicker(false)}
      />

      {/* Start time picker */}
      <TimePickerModal
        visible={showStartTimePicker}
        title="Start Time"
        value={startTime}
        onChange={onStartTimeChange}
        onClose={() => setShowStartTimePicker(false)}
      />

      {/* End time picker */}
      <TimePickerModal
        visible={showEndTimePicker}
        title="End Time"
        value={endTime}
        onChange={onEndTimeChange}
        onClose={() => setShowEndTimePicker(false)}
      />
    </>
  );
}
