import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CalendarGrid } from '@/components/events/CalendarGrid';

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
 * Uses the app's themed {@link CalendarGrid} on both iOS and Android (no native
 * date dialog), hosted in a CeolX bottom sheet with explicit Clear / Done actions.
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

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/60" onPress={onClose} />
      <View
        className="bg-[#1a1a1a] rounded-t-3xl px-5 pt-4"
        style={{ paddingBottom: insets.bottom + 16 }}
      >
        <View className="flex-row items-center justify-between mb-2">
          <Pressable onPress={onClear} hitSlop={12} accessibilityRole="button">
            <Text className="text-[15px] text-white/60 font-urbanist underline">Clear</Text>
          </Pressable>
          <Text className="text-base font-bold text-white font-urbanist">Pick a date</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button">
            <Text className="text-[15px] font-semibold text-[#C8FF2F] font-urbanist">Done</Text>
          </Pressable>
        </View>
        <CalendarGrid value={value} onChange={onSelect} minimumDate={minimumDate} />
      </View>
    </Modal>
  );
}
