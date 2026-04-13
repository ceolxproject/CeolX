import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

// ─── Component ──────────────────────────────────────────────────────────────

type Props = {
  visible: boolean;
  value: Date | null;
  minimumDate?: Date;
  onSelect: (date: Date) => void;
  onClose: () => void;
};

export function CalendarPickerModal({ visible, value, minimumDate, onSelect, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const today = new Date();

  const [viewYear, setViewYear] = useState(value?.getFullYear() ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(value?.getMonth() ?? today.getMonth());

  // Sync view to value whenever the modal opens
  useEffect(() => {
    if (visible) {
      setViewYear(value?.getFullYear() ?? today.getFullYear());
      setViewMonth(value?.getMonth() ?? today.getMonth());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const cells = buildGrid(viewYear, viewMonth);

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else setViewMonth((m) => m + 1);
  };

  // Disable "previous" when we're already at the minimum month
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
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      {/* Sibling layout keeps backdrop Pressable separate from the sheet so it
          never interferes with touch handling inside the sheet (e.g. day cells). */}
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.55)' }]}
          onPress={onClose}
        />

        <View
          style={{
            backgroundColor: '#16162a',
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingHorizontal: 16,
            paddingBottom: Math.max(insets.bottom, 20),
          }}
        >
          {/* Drag handle */}
          <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
            <View
              style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: 'rgba(255,255,255,0.15)',
              }}
            />
          </View>

          {/* Month / year navigation */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: 14,
            }}
          >
            <Pressable onPress={prevMonth} hitSlop={12} disabled={!canGoPrev}>
              <Ionicons name="chevron-back" size={22} color={canGoPrev ? '#ffffff' : '#444'} />
            </Pressable>
            <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600', letterSpacing: 0.2 }}>
              {MONTH_NAMES[viewMonth]} {viewYear}
            </Text>
            <Pressable onPress={nextMonth} hitSlop={12}>
              <Ionicons name="chevron-forward" size={22} color="#ffffff" />
            </Pressable>
          </View>

          {/* Day-of-week headers */}
          <View style={{ flexDirection: 'row', marginBottom: 6 }}>
            {DAY_LABELS.map((label) => (
              <View key={label} style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ color: '#6b6b8a', fontSize: 12, fontWeight: '500' }}>{label}</Text>
              </View>
            ))}
          </View>

          {/* Calendar grid */}
          {Array.from({ length: cells.length / 7 }).map((_, rowIdx) => (
            <View key={rowIdx} style={{ flexDirection: 'row', marginBottom: 2 }}>
              {cells.slice(rowIdx * 7, rowIdx * 7 + 7).map((day, colIdx) => {
                if (!day) return <View key={colIdx} style={{ flex: 1, height: 40 }} />;

                const selected = value ? isSameDay(day, value) : false;
                const isToday = isSameDay(day, today);
                const disabled = isDisabled(day);

                return (
                  <Pressable
                    key={colIdx}
                    style={{ flex: 1, alignItems: 'center', justifyContent: 'center', height: 40 }}
                    onPress={() => !disabled && onSelect(day)}
                    disabled={disabled}
                  >
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: selected ? '#C8FF2F' : 'transparent',
                        // Today ring (only when not selected)
                        borderWidth: isToday && !selected ? 1.5 : 0,
                        borderColor: '#6C63FF',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: selected || isToday ? '600' : '400',
                          color: selected ? '#080808' : disabled ? '#3a3a5c' : '#ffffff',
                        }}
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
          <View style={{ paddingTop: 12, alignItems: 'center', minHeight: 28 }}>
            {value ? (
              <Text style={{ color: '#C8FF2F', fontSize: 13, fontWeight: '500' }}>
                {value.toLocaleDateString('en-IE', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </Text>
            ) : (
              <Text style={{ color: '#6b6b8a', fontSize: 13 }}>No date selected</Text>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}
