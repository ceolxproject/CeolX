import { Ionicons } from '@expo/vector-icons';
import { cn } from 'heroui-native';
import { useEffect, useState } from 'react';
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
 * Renders as a trigger button + an expandable calendar grid below it,
 * matching the CategoryPicker inline dropdown pattern.
 */
export function CalendarPicker({ value, onChange, minimumDate, error }: Props) {
  const [open, setOpen] = useState(false);
  const today = new Date();

  const [viewYear, setViewYear] = useState(value?.getFullYear() ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(value?.getMonth() ?? today.getMonth());

  // Sync calendar view to selected value when dropdown opens
  useEffect(() => {
    if (open) {
      setViewYear(value?.getFullYear() ?? today.getFullYear());
      setViewMonth(value?.getMonth() ?? today.getMonth());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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
          {/* Month / year navigation */}
          <View className="flex-row items-center justify-between py-3">
            <Pressable onPress={prevMonth} hitSlop={12} disabled={!canGoPrev}>
              <Ionicons name="chevron-back" size={20} color={canGoPrev ? '#ffffff' : '#3a3a5c'} />
            </Pressable>
            <Text className="text-base font-semibold text-white tracking-wide">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </Text>
            <Pressable onPress={nextMonth} hitSlop={12}>
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
                      if (!disabled) {
                        onChange(day);
                        setOpen(false);
                      }
                    }}
                    disabled={disabled}
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
              <Text className="text-[13px] font-medium text-[#C8FF2F]">
                {value.toLocaleDateString('en-IE', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </Text>
            ) : (
              <Text className="text-[13px] text-gray-7">No date selected</Text>
            )}
          </View>
        </View>
      )}

      {error && <Text className="text-xs text-error font-urbanist">{error}</Text>}
    </View>
  );
}
