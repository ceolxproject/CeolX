import DateTimePicker from '@react-native-community/datetimepicker';
import { cn } from 'heroui-native';
import { useState } from 'react';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

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
  showManualAddress: boolean;
  onToggleManualAddress: () => void;
  errors: Record<string, string>;
  onContinue: () => void;
  onBack: () => void;
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
  showManualAddress,
  onToggleManualAddress,
  errors,
  onContinue,
  onBack,
}: Props) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  return (
    <View className="gap-5">
      {/* ── Date ── */}
      <View className="gap-1.5">
        <Text className="text-sm font-medium text-gray-3">Date</Text>
        <Pressable
          className={cn(
            'flex-row items-center justify-between rounded-lg border px-3 py-3',
            errors.dateStart ? 'border-error' : 'border-gray-8',
            'bg-surface'
          )}
          onPress={() => setShowDatePicker(true)}
        >
          <Text className={cn('text-sm', dateStart ? 'text-white' : 'text-neutral-500')}>
            {dateStart ? formatDate(dateStart) : 'Select Date'}
          </Text>
          <Text className="text-neutral-500 text-sm">›</Text>
        </Pressable>
        {errors.dateStart && <Text className="text-xs text-error">{errors.dateStart}</Text>}

        {showDatePicker && (
          <DateTimePicker
            value={dateStart ?? new Date()}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            minimumDate={new Date()}
            onChange={(_event, selected) => {
              setShowDatePicker(Platform.OS === 'ios');
              if (selected) onDateStartChange(selected);
            }}
            themeVariant="dark"
          />
        )}
      </View>

      {/* ── Time ── */}
      <View className="gap-1.5">
        <Text className="text-sm font-medium text-gray-3">Time</Text>
        <View className="flex-row gap-3">
          {/* Start Time */}
          <View className="flex-1 gap-1">
            <Pressable
              className={cn(
                'flex-row items-center justify-between rounded-lg border px-3 py-3',
                errors.startTime ? 'border-error' : 'border-gray-8',
                'bg-surface'
              )}
              onPress={() => setShowStartTimePicker(true)}
            >
              <Text className={cn('text-sm', startTime ? 'text-white' : 'text-neutral-500')}>
                {startTime ? formatTime(startTime) : 'Start Time'}
              </Text>
              <Text className="text-neutral-500 text-sm">›</Text>
            </Pressable>
            {errors.startTime && <Text className="text-xs text-error">{errors.startTime}</Text>}
          </View>

          {/* End Time */}
          <View className="flex-1 gap-1">
            <Pressable
              className={cn(
                'flex-row items-center justify-between rounded-lg border px-3 py-3',
                errors.endTime ? 'border-error' : 'border-gray-8',
                'bg-surface'
              )}
              onPress={() => setShowEndTimePicker(true)}
            >
              <Text className={cn('text-sm', endTime ? 'text-white' : 'text-neutral-500')}>
                {endTime ? formatTime(endTime) : 'End Time'}
              </Text>
              <Text className="text-neutral-500 text-sm">›</Text>
            </Pressable>
            {errors.endTime && <Text className="text-xs text-error">{errors.endTime}</Text>}
          </View>
        </View>

        {showStartTimePicker && (
          <DateTimePicker
            value={startTime ?? new Date()}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(_event, selected) => {
              setShowStartTimePicker(Platform.OS === 'ios');
              if (selected) onStartTimeChange(selected);
            }}
            themeVariant="dark"
          />
        )}

        {showEndTimePicker && (
          <DateTimePicker
            value={endTime ?? new Date()}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(_event, selected) => {
              setShowEndTimePicker(Platform.OS === 'ios');
              if (selected) onEndTimeChange(selected);
            }}
            themeVariant="dark"
          />
        )}
      </View>

      {/* ── Venue ── */}
      <View className="gap-1.5">
        <View className="flex-row items-center justify-between">
          <Text className="text-sm font-medium text-gray-3">Choose Venue</Text>
          <Pressable onPress={onToggleManualAddress}>
            <Text className="text-xs font-semibold text-[#C8FF2F]">
              {showManualAddress ? 'USE MAP' : 'ENTER MANUALLY'}
            </Text>
          </Pressable>
        </View>

        {showManualAddress ? (
          <View className="gap-1">
            <View
              className={cn(
                'rounded-lg border px-3 py-2.5 bg-surface',
                errors.venueAddress ? 'border-error' : 'border-gray-8'
              )}
            >
              <TextInput
                className="text-sm text-white"
                placeholder="Enter venue address"
                placeholderTextColor="#8d8d8d"
                value={venueAddress}
                onChangeText={onVenueAddressChange}
              />
            </View>
            {errors.venueAddress && (
              <Text className="text-xs text-error">{errors.venueAddress}</Text>
            )}
          </View>
        ) : (
          <View className="gap-2">
            <View
              className={cn(
                'h-[250px] rounded-xl overflow-hidden border',
                errors.lat ? 'border-error' : 'border-gray-8'
              )}
            >
              <MapView
                className="flex-1"
                initialRegion={{
                  ...IRELAND_CENTER,
                  ...IRELAND_DELTA,
                }}
                onPress={(e) => {
                  const { latitude, longitude } = e.nativeEvent.coordinate;
                  onLocationChange(latitude, longitude);
                }}
              >
                {lat !== null && lng !== null && (
                  <Marker
                    coordinate={{ latitude: lat, longitude: lng }}
                    draggable
                    onDragEnd={(e) => {
                      const { latitude, longitude } = e.nativeEvent.coordinate;
                      onLocationChange(latitude, longitude);
                    }}
                  />
                )}
              </MapView>
            </View>

            {lat !== null && lng !== null && (
              <Text className="text-xs text-neutral-400">
                {lat.toFixed(5)}, {lng.toFixed(5)}
              </Text>
            )}

            {errors.lat && <Text className="text-xs text-error">{errors.lat}</Text>}
          </View>
        )}
      </View>

      {/* ── Buttons ── */}
      <View className="flex-row gap-3 mt-2">
        <Pressable
          className="flex-1 items-center justify-center rounded-lg border border-white py-3"
          onPress={onBack}
        >
          <Text className="text-white font-semibold text-base">BACK</Text>
        </Pressable>

        <Pressable
          className="flex-1 items-center justify-center rounded-lg bg-blue-10 py-3"
          onPress={onContinue}
        >
          <Text className="text-white font-semibold text-base">CONTINUE</Text>
        </Pressable>
      </View>
    </View>
  );
}
