import { Ionicons } from '@expo/vector-icons';
import { cn } from 'heroui-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

// ─── Helpers ────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const DAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Returns an array of Date | null cells for the calendar grid.
 *  Week starts on Monday. Leading/trailing nulls pad the first/last rows. */
function buildGrid(year: number, month: number): (Date | null)[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // getDay() returns 0=Sun…6=Sat; convert to Mon-first (0=Mon)
  const rawDow = new Date(year, month, 1).getDay();
  const leadingNulls = rawDow === 0 ? 6 : rawDow - 1;

  const cells: (Date | null)[] = Array.from<Date | null>({ length: leadingNulls }).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/** Full, screen-reader friendly description of a day (e.g. "Monday, 15 June 2026"). */
function fullDateLabel(date: Date): string {
  return date.toLocaleDateString('en-IE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// ─── Component ──────────────────────────────────────────────────────────────

type Props = {
  value: Date | null;
  onChange: (date: Date) => void;
  minimumDate?: Date;
};

/**
 * Themed, navigable month calendar grid. Stateless about its container — used
 * inline inside {@link CalendarPicker} (Create/Edit Event) and inside the
 * Discover date sheet ({@link DatePickerSheet}). This is the single on-brand
 * calendar UI for the whole app; no native date picker is used anywhere.
 */
export function CalendarGrid({ value, onChange, minimumDate }: Props) {
  const today = new Date();

  const [viewYear, setViewYear] = useState(value?.getFullYear() ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(value?.getMonth() ?? today.getMonth());

  const cells = buildGrid(viewYear, viewMonth);

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const canGoPrev =
    !minimumDate ||
    viewYear > minimumDate.getFullYear() ||
    (viewYear === minimumDate.getFullYear() && viewMonth > minimumDate.getMonth());

  const isDisabled = (day: Date) => {
    if (!minimumDate) return false;
    const minMidnight = new Date(
      minimumDate.getFullYear(),
      minimumDate.getMonth(),
      minimumDate.getDate()
    );
    return day < minMidnight;
  };

  return (
    <View>
      {/* Month / year navigation */}
      <View className="flex-row items-center justify-between py-3">
        <Pressable
          onPress={prevMonth}
          hitSlop={12}
          disabled={!canGoPrev}
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          accessibilityState={{ disabled: !canGoPrev }}
        >
          <Ionicons name="chevron-back" size={20} color={canGoPrev ? '#ffffff' : '#3a3a5c'} />
        </Pressable>
        <Text className="text-base font-semibold text-white tracking-wide">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </Text>
        <Pressable
          onPress={nextMonth}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Next month"
        >
          <Ionicons name="chevron-forward" size={20} color="#ffffff" />
        </Pressable>
      </View>

      {/* Day-of-week headers */}
      <View className="flex-row mb-1.5">
        {DAY_LABELS.map((label) => (
          <View key={label} className="flex-1 items-center">
            <Text className="text-xs font-medium text-gray-7">{label}</Text>
          </View>
        ))}
      </View>

      {/* Calendar rows */}
      {Array.from({ length: cells.length / 7 }).map((_, rowIdx) => (
        <View key={rowIdx} className="flex-row mb-0.5">
          {cells.slice(rowIdx * 7, rowIdx * 7 + 7).map((day, colIdx) => {
            if (!day) {
              return <View key={colIdx} className="flex-1 h-10" />;
            }

            const selected = value ? isSameDay(day, value) : false;
            const isToday = isSameDay(day, today);
            const disabled = isDisabled(day);

            return (
              <Pressable
                key={colIdx}
                className="flex-1 items-center justify-center h-10"
                onPress={() => {
                  if (!disabled) onChange(day);
                }}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityLabel={fullDateLabel(day)}
                accessibilityState={{ selected, disabled }}
              >
                <View
                  className={cn(
                    'w-9 h-9 rounded-full items-center justify-center',
                    selected && 'bg-[#C8FF2F]',
                    isToday && !selected && 'border-[1.5px] border-[#6C63FF]'
                  )}
                >
                  <Text
                    className={cn(
                      'text-sm',
                      selected ? 'font-semibold text-[#080808]' : '',
                      isToday && !selected ? 'font-semibold text-white' : '',
                      !selected && !isToday && !disabled ? 'text-white' : '',
                      disabled && 'text-[#3a3a5c]'
                    )}
                  >
                    {day.getDate()}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}

      {/* Selected date label */}
      <View className="pt-2 items-center min-h-[24px]">
        {value ? (
          <Text className="text-[13px] font-medium text-[#C8FF2F]">{fullDateLabel(value)}</Text>
        ) : (
          <Text className="text-[13px] text-gray-7">No date selected</Text>
        )}
      </View>
    </View>
  );
}
