import { Ionicons } from '@expo/vector-icons';
import * as Sentry from '@sentry/react-native';
import { useQuery } from '@tanstack/react-query';
import { cn } from 'heroui-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { appToast } from '@/components/AppToast';
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
  /** The currently selected registered venue's ID (drives the dropdown's
   *  selected label, so an event being edited shows its venue pre-selected). */
  venueId?: string;
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
  venueId,
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
  const { data: registeredVenues = [], isLoading: isLoadingVenues } = useQuery(
    trpc.venues.list.queryOptions()
  );

  // Selected venue label is derived from the chosen venueId + the loaded venue
  // list — not held in separate state — so editing an event with a venue
  // already set shows it pre-selected once the list resolves.
  const selectedVenueName = registeredVenues.find((v) => v.id === venueId)?.name ?? '';

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
        appToast.warning(
          'Could not locate address',
          "Your venue/festival address was set but we couldn't find it on the map. You can adjust the pin manually."
        );
      }
    } catch (err) {
      // Geocode threw — set the address text and tell the user the pin couldn't
      // be placed (mirrors the zero-results branch above, not a silent fallback).
      Sentry.captureException(err, { tags: { feature: 'venue-prefill-geocode' } });
      onVenueAddressChange(myVenueAddress);
      appToast.warning(
        'Could not locate address',
        "Your venue/festival address was set but we couldn't find it on the map. You can adjust the pin manually."
      );
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
              label={isVenue ? 'Event Location' : 'Choose Venue'}
              hint={
                isVenue
                  ? 'Defaults to your venue/festival address — change it only if this event is somewhere else.'
                  : 'Where the event happens. Pick a registered venue or tap “Enter manually” to drop a pin on the map.'
              }
            />
            {/* Venues switch to/from a custom location via the explicit in-body
                actions below, so the generic manual-entry toggle is artist-only. */}
            {!isVenue && (
              <Pressable onPress={onToggleManualAddress}>
                <Text className="text-xs font-bold text-[#C8FF2F] font-urbanist tracking-wide">
                  {showManualAddress ? 'SELECT VENUE' : 'ENTER MANUALLY'}
                </Text>
              </Pressable>
            )}
          </View>

          {showManualAddress || (isVenue && !myVenueAddress) ? (
            /* Map + search mode — user pins a custom location via the shared
               LocationPicker (single source of truth across onboarding,
               profile edit and event creation). Venues land here either by
               tapping "Set a different location" or if their profile somehow
               has no saved address. */
            <View className="gap-2">
              <LocationPicker
                lat={lat}
                lng={lng}
                address={venueAddress}
                error={errors.lat}
                searchPlaceholder={
                  isVenue
                    ? 'Search city, county or venue name…'
                    : 'Search for performance location…'
                }
                onChange={({ lat: pickedLat, lng: pickedLng, address }) => {
                  onLocationChange(pickedLat, pickedLng);
                  onVenueAddressChange(address);
                }}
              />
              {isVenue && myVenueAddress && (
                <Pressable
                  className="flex-row items-center gap-1.5 self-start"
                  onPress={() => {
                    void handleUseMyVenue();
                    onToggleManualAddress();
                  }}
                  disabled={isPreFilling}
                >
                  <Ionicons name="refresh" size={14} color="#6C63FF" />
                  <Text className="text-sm text-[#6C63FF] font-urbanist">
                    Reset to my venue/festival location
                  </Text>
                </Pressable>
              )}
            </View>
          ) : isVenue ? (
            /* Venue default — prefilled venue location, clearly labelled, with a
               clear affordance to choose a different location for this event. */
            <View className="gap-2">
              <View className="rounded-lg border border-[#6C63FF]/40 bg-[#6C63FF]/10 px-4 py-3 gap-1.5">
                <View className="flex-row items-center gap-2">
                  <Ionicons name="business" size={14} color="#6C63FF" />
                  <Text className="text-xs text-[#6C63FF] font-urbanist tracking-wide">
                    Using your venue/festival location
                  </Text>
                </View>
                {isPreFilling ? (
                  <ActivityIndicator size="small" color="#6C63FF" />
                ) : (
                  <Text
                    className="text-sm text-white font-urbanist"
                    numberOfLines={2}
                    ellipsizeMode="tail"
                  >
                    {venueAddress || myVenueAddress}
                  </Text>
                )}
              </View>

              <Pressable
                className="flex-row items-center gap-1.5 self-start"
                onPress={onToggleManualAddress}
              >
                <Ionicons name="location-outline" size={14} color="#6C63FF" />
                <Text className="text-sm text-[#6C63FF] font-urbanist">
                  Set a different location for this event
                </Text>
              </Pressable>

              {errors.lat && <Text className="text-xs text-error font-urbanist">{errors.lat}</Text>}
            </View>
          ) : (
            /* Artist default — pick from registered venues. */
            <View className="gap-1.5">
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
                        // M8 V-09: an on-hold venue stays LISTED but is not
                        // selectable, and says why. The client asked for this
                        // specifically — an absent venue reads as CeolX failing to
                        // show it, whereas "profile on hold" attributes the absence
                        // to the venue. The manual-address hint below is the exit;
                        // without it the artist hits a dead end and the whole point
                        // of the treatment inverts.
                        <Pressable
                          key={v.id}
                          disabled={v.onHold}
                          accessibilityState={{ disabled: v.onHold }}
                          accessibilityHint={
                            v.onHold
                              ? 'This venue cannot be selected while its profile is on hold'
                              : undefined
                          }
                          className={`px-4 py-3 border-b border-gray-8 ${
                            v.onHold ? 'opacity-60' : 'active:bg-white/5'
                          }`}
                          onPress={() => {
                            if (v.onHold) return;
                            setShowVenueDropdown(false);
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
                          <View className="flex-row items-center gap-2">
                            <Text className="shrink text-sm font-semibold text-white font-urbanist">
                              {v.name}
                            </Text>
                            {v.onHold ? (
                              <View className="rounded border border-gray-7 px-1.5 py-px">
                                <Text className="text-[10px] font-bold uppercase tracking-[0.2px] text-gray-7 font-urbanist">
                                  On hold
                                </Text>
                              </View>
                            ) : null}
                          </View>
                          <Text
                            className="text-xs text-gray-7 font-urbanist mt-0.5"
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {v.onHold
                              ? "This venue's profile is on hold — add the address manually below instead."
                              : v.address}
                          </Text>
                        </Pressable>
                      ))
                    )}
                  </View>
                )}
              </View>

              {venueAddress ? (
                <View className="flex-row">
                  <Text className="text-xs text-gray-7 font-urbanist">📍 </Text>
                  <Text
                    className="flex-1 text-xs text-gray-7 font-urbanist"
                    numberOfLines={2}
                    ellipsizeMode="tail"
                  >
                    {venueAddress}
                  </Text>
                </View>
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
