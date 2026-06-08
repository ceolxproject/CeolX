import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Modal, Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface DatePickerSheetProps {
  visible: boolean;
  /** Currently selected day, or null when no specific date is active. */
  value: Date | null;
  /** Earliest selectable day. Defaults to today (no past events in the feed). */
  minimumDate?: Date;
  onSelect: (date: Date) => void;
  onClear: () => void;
  onClose: () => void;
}

/**
 * Cross-platform single-day calendar picker for the feed header.
 *
 * Android renders the native date dialog directly (it manages its own scrim and
 * dismissal). iOS has no built-in modal, so the inline calendar is hosted in a
 * bottom sheet with explicit Clear / Done actions.
 */
export function DatePickerSheet({
  visible,
  value,
  minimumDate,
  onSelect,
  onClear,
  onClose,
}: DatePickerSheetProps) {
  const insets = useSafeAreaInsets();
  const initial = value ?? minimumDate ?? new Date();

  if (!visible) return null;

  // ── Android: native dialog, no custom chrome ──────────────────────────────
  if (Platform.OS === 'android') {
    const handleChange = (event: DateTimePickerEvent, picked?: Date) => {
      if (event.type === 'set' && picked) {
        onSelect(picked);
      }
      onClose();
    };
    return (
      <DateTimePicker
        value={initial}
        mode="date"
        display="calendar"
        minimumDate={minimumDate}
        onChange={handleChange}
      />
    );
  }

  // ── iOS: host the inline calendar in a bottom sheet ───────────────────────
  const handleChange = (_event: DateTimePickerEvent, picked?: Date) => {
    if (picked) onSelect(picked);
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/60" onPress={onClose} />
      <View
        className="bg-[#1a1a1a] rounded-t-3xl px-5 pt-4"
        style={{ paddingBottom: insets.bottom + 16 }}
      >
        <View className="flex-row items-center justify-between mb-2">
          <Pressable onPress={onClear} hitSlop={12}>
            <Text className="text-[15px] text-white/60 font-urbanist underline">Clear</Text>
          </Pressable>
          <Text className="text-base font-bold text-white font-urbanist">Pick a date</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text className="text-[15px] font-semibold text-[#C8FF2F] font-urbanist">Done</Text>
          </Pressable>
        </View>
        <DateTimePicker
          value={initial}
          mode="date"
          display="inline"
          minimumDate={minimumDate}
          accentColor="#C8FF2F"
          themeVariant="dark"
          onChange={handleChange}
        />
      </View>
    </Modal>
  );
}
