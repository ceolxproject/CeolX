import { Ionicons } from '@expo/vector-icons';
import { cn } from 'heroui-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { CalendarGrid } from '@/components/events/CalendarGrid';

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString('en-IE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// ─── Component ──────────────────────────────────────────────────────────────

type Props = {
  value: Date | null;
  onChange: (date: Date) => void;
  minimumDate?: Date;
  error?: string;
};

/**
 * Inline attached dropdown calendar for selecting a date.
 * Renders as a trigger button + an expandable {@link CalendarGrid} below it,
 * matching the CategoryPicker inline dropdown pattern.
 */
export function CalendarPicker({ value, onChange, minimumDate, error }: Props) {
  const [open, setOpen] = useState(false);

  const handleSelect = (date: Date) => {
    onChange(date);
    setOpen(false);
  };

  return (
    <View className="gap-1">
      {/* ── Trigger ── */}
      <Pressable
        className={cn(
          'flex-row items-center justify-between rounded-lg border bg-surface px-4 py-3',
          error ? 'border-error' : open ? 'border-[#6C63FF]' : 'border-gray-8'
        )}
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityLabel="Select event date"
      >
        <Text className={cn('text-sm font-urbanist', value ? 'text-white' : 'text-gray-7')}>
          {value ? formatDisplayDate(value) : 'Select Date'}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color="#8d8d8d" />
      </Pressable>

      {/* ── Inline calendar grid ── */}
      {open && (
        <View className="rounded-lg border border-gray-8 bg-surface overflow-hidden px-3 pb-3">
          <CalendarGrid value={value} onChange={handleSelect} minimumDate={minimumDate} />
        </View>
      )}

      {error && <Text className="text-xs text-error font-urbanist">{error}</Text>}
    </View>
  );
}
