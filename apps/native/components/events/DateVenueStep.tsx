import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { cn } from 'heroui-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';

import { CalendarPicker } from '@/components/events/CalendarPicker';
import { FieldLabel } from '@/components/events/FieldLabel';
import { TimePickerModal } from '@/components/events/TimePickerModal';
import { LocationPicker } from '@/components/LocationPicker';
import { geocodeAddress } from '@/utils/geocode';
import { trpc } from '@/utils/trpc';

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
  /** Venue creator's own stored pin — preferred over re-geocoding the address. */
  myVenueLat?: number | null;
  myVenueLng?: number | null;
  isVenue?: boolean;
  /** When true, skip auto-pre-fill (user is editing an existing event with its own location) */
  isEditing?: boolean;
};

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
  myVenueLat,
  myVenueLng,
  isVenue,
  isEditing,
}: Props) {
  // Picker visibility state
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  const [isPreFilling, setIsPreFilling] = useState(false);

  // Artist venue picker
  const [showVenueDropdown, setShowVenueDropdown] = useState(false);
  const [selectedVenueName, setSelectedVenueName] = useState('');
  const { data: registeredVenues = [], isLoading: isLoadingVenues } = useQuery(
    trpc.venues.list.queryOptions()
  );

  const handleUseMyVenue = async () => {
    if (!myVenueAddress) return;
    // Prefer the venue's stored pin (captured at onboarding) — it's the source
    // of truth and avoids a fragile re-geocode of the address string.
    if (typeof myVenueLat === 'number' && typeof myVenueLng === 'number') {
      onLocationChange(myVenueLat, myVenueLng);
      onVenueAddressChange(myVenueAddress);
      return;
    }
    setIsPreFilling(true);
    try {
      const results = await geocodeAddress(myVenueAddress);
      if (results.length > 0) {
        const { lat, lng } = results[0];
        onLocationChange(lat, lng);
        onVenueAddressChange(myVenueAddress);
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
          <FieldLabel
            label="Date"
            hint="The day your event takes place. Past dates can't be selected."
          />
          <CalendarPicker
            value={dateStart}
            onChange={onDateStartChange}
            minimumDate={new Date()}
            error={errors.dateStart}
          />
        </View>

        {/* ── Time ── */}
        <View className="gap-1.5">
          <FieldLabel
            label="Time"
            hint="When the event starts and (optionally) ends. The end time can't be before the start time."
          />
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
            <FieldLabel
              label="Choose Venue"
              hint="Where the event happens. Pick a registered venue or tap “Enter manually” to drop a pin on the map."
            />
            <Pressable onPress={onToggleManualAddress}>
              <Text className="text-xs font-bold text-[#C8FF2F] font-urbanist tracking-wide">
                {showManualAddress ? 'SELECT VENUE' : 'ENTER MANUALLY'}
              </Text>
            </Pressable>
          </View>

          {showManualAddress ? (
            /* Map + search mode — user pins a custom location via the shared
               LocationPicker (single source of truth across onboarding,
               profile edit and event creation). */
            <LocationPicker
              lat={lat}
              lng={lng}
              address={venueAddress}
              error={errors.lat}
              searchPlaceholder={
                isVenue ? 'Search city, county or venue name…' : 'Search for performance location…'
              }
              onChange={({ lat: pickedLat, lng: pickedLng, address }) => {
                onLocationChange(pickedLat, pickedLng);
                onVenueAddressChange(address);
              }}
            />
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
                            onPress={() => {
                              setShowVenueDropdown(false);
                              setSelectedVenueName(v.name);
                              onVenueAddressChange(v.address);
                              onVenueIdChange(v.id);
                              // Use the venue's stored pin directly — no fragile
                              // re-geocode of the address. The server also
                              // inherits the venue's coordinates from venueId,
                              // so the event is always correctly located.
                              if (v.lat !== null && v.lng !== null) {
                                onLocationChange(v.lat, v.lng);
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
