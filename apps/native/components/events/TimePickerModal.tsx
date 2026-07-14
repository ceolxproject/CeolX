import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ─── Constants ───────────────────────────────────────────────────────────────

const ITEM_HEIGHT = 48;

// Reusable absoluteFillObject equivalent without importing StyleSheet everywhere
const absoluteFill = StyleSheet.absoluteFillObject;
const VISIBLE_ITEMS = 5; // Must be odd so the centre item is the selection

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

// Copies of the wheel stacked to fake an endless loop; we sit in the middle
// copy and recenter after every scroll so there's always runway both ways.
// FlatList virtualizes, so a big number here costs nothing — only ~10 rows
// are ever mounted regardless of copy count.
const LOOPS = 40;
const MIDDLE_LOOP = Math.floor(LOOPS / 2);

// Wrap a raw (possibly negative, from overscroll bounce) row index into [0, len).
function wrapIndex(rawIndex: number, len: number) {
  return ((rawIndex % len) + len) % len;
}

// ─── WheelColumn ─────────────────────────────────────────────────────────────

// Known limitation: this custom wheel is not screen-reader operable (TalkBack /
// VoiceOver). Kept for the dark drum-roller design. To close the gap, add
// accessibilityRole="adjustable" with increment/decrement actions, or swap in
// @react-native-community/datetimepicker (accessible + native looping).
type WheelProps = {
  items: string[];
  value: number;
  onChange: (index: number) => void;
};

function WheelColumn({ items, value, onChange }: WheelProps) {
  const listRef = useRef<FlatList<string>>(null);
  // Tracks whether a user-initiated scroll is in progress so external value
  // changes (e.g. modal opening with a new time) don't fight the scroll.
  const isUserScrolling = useRef(false);
  // A fling fires onScrollEndDrag THEN onMomentumScrollEnd; this flag lets
  // drag-end defer to momentum so we don't commit (and recenter) twice.
  const willMomentum = useRef(false);
  const padding = Math.floor(VISIBLE_ITEMS / 2) * ITEM_HEIGHT;
  const len = items.length;
  const midIndex = (index: number) => MIDDLE_LOOP * len + index;

  // Stable reference — rebuilding this each render would defeat virtualization.
  const data = useMemo(
    () => Array.from({ length: len * LOOPS }, (_, i) => items[i % len]),
    [items, len]
  );

  // Scroll to new position (in the middle copy) whenever value is set externally
  useEffect(() => {
    if (!isUserScrolling.current) {
      listRef.current?.scrollToOffset({
        offset: (MIDDLE_LOOP * len + value) * ITEM_HEIGHT,
        animated: false,
      });
    }
  }, [value, len]);

  const commit = (offsetY: number) => {
    isUserScrolling.current = false;
    const index = wrapIndex(Math.round(offsetY / ITEM_HEIGHT), len);
    // Snap back into the middle copy so 23:59 → 00:00 keeps scrolling down.
    // Recentering shifts by whole wheel-lengths, so it's visually invisible.
    listRef.current?.scrollToOffset({ offset: midIndex(index) * ITEM_HEIGHT, animated: false });
    onChange(index);
  };

  return (
    <View style={{ flex: 1, height: ITEM_HEIGHT * VISIBLE_ITEMS, overflow: 'hidden' }}>
      {/* Highlight strip — sits behind the scroll content */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: padding,
          left: 8,
          right: 8,
          height: ITEM_HEIGHT,
          borderRadius: 10,
          backgroundColor: 'rgba(108, 99, 255, 0.18)',
          borderWidth: 1,
          borderColor: 'rgba(108, 99, 255, 0.45)',
        }}
      />

      <FlatList
        ref={listRef}
        data={data}
        // Rows read `value` for the centred-item highlight, which isn't in
        // `data`; extraData tells FlatList to re-render them when it changes.
        extraData={value}
        keyExtractor={(_, i) => String(i)}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        getItemLayout={(_, index) => ({
          length: ITEM_HEIGHT,
          offset: ITEM_HEIGHT * index,
          index,
        })}
        initialScrollIndex={midIndex(value)}
        contentContainerStyle={{ paddingVertical: padding }}
        onScrollBeginDrag={() => {
          isUserScrolling.current = true;
        }}
        onMomentumScrollBegin={() => {
          willMomentum.current = true;
        }}
        onMomentumScrollEnd={(e) => commit(e.nativeEvent.contentOffset.y)}
        // Drag-end fires before any fling. Wait a beat: if momentum takes over,
        // let onMomentumScrollEnd settle it. Only commit here on a slow drag
        // with no momentum — otherwise we'd snap mid-fling and jump again.
        onScrollEndDrag={(e) => {
          willMomentum.current = false;
          const y = e.nativeEvent.contentOffset.y;
          setTimeout(() => {
            if (!willMomentum.current) commit(y);
          }, 60);
        }}
        renderItem={({ item, index }) => {
          const isCentre = index % len === value;
          return (
            <View style={{ height: ITEM_HEIGHT, alignItems: 'center', justifyContent: 'center' }}>
              <Text
                style={{
                  fontSize: isCentre ? 22 : 18,
                  fontWeight: isCentre ? '700' : '400',
                  color: isCentre ? '#ffffff' : 'rgba(255,255,255,0.28)',
                  letterSpacing: 0.5,
                }}
              >
                {item}
              </Text>
            </View>
          );
        }}
      />
    </View>
  );
}

// ─── TimePickerModal ─────────────────────────────────────────────────────────

type Props = {
  visible: boolean;
  title?: string;
  value: Date | null;
  onChange: (date: Date) => void;
  onClose: () => void;
};

export function TimePickerModal({
  visible,
  title = 'Select Time',
  value,
  onChange,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const [stagedHour, setStagedHour] = useState(0);
  const [stagedMinute, setStagedMinute] = useState(0);

  // Sync staged state whenever the modal becomes visible
  useEffect(() => {
    if (visible) {
      const d = value ?? new Date();
      setStagedHour(d.getHours());
      setStagedMinute(d.getMinutes());
    }
  }, [visible, value]);

  const handleDone = () => {
    const result = value ? new Date(value) : new Date();
    result.setHours(stagedHour, stagedMinute, 0, 0);
    onChange(result);
    onClose();
  };

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      {/* Sibling layout: backdrop + sheet are at the same level.
          The sheet is rendered AFTER the backdrop so it sits on top — touches
          on the sheet never reach the backdrop Pressable. This avoids using
          onStartShouldSetResponder which would steal the responder from the
          scroll wheel columns and break scrolling. */}
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        {/* Backdrop */}
        <Pressable
          style={{
            ...absoluteFill,
            backgroundColor: 'rgba(0,0,0,0.55)',
          }}
          onPress={onClose}
        />

        {/* Sheet panel — rendered on top of backdrop, no responder override needed */}
        <View
          style={{
            backgroundColor: '#16162a',
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
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

          {/* Toolbar */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 20,
              paddingVertical: 14,
              borderBottomWidth: 1,
              borderBottomColor: 'rgba(255,255,255,0.08)',
            }}
          >
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={{ fontSize: 16, color: '#8d8d8d' }}>Cancel</Text>
            </Pressable>
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#ffffff' }}>{title}</Text>
            <Pressable onPress={handleDone} hitSlop={8}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#6C63FF' }}>Done</Text>
            </Pressable>
          </View>

          {/* Drum-roller wheels */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 40,
              paddingVertical: 16,
            }}
          >
            <WheelColumn items={HOURS} value={stagedHour} onChange={setStagedHour} />

            <Text
              style={{
                fontSize: 32,
                fontWeight: '700',
                color: '#ffffff',
                paddingHorizontal: 8,
                marginBottom: 2,
              }}
            >
              :
            </Text>

            <WheelColumn items={MINUTES} value={stagedMinute} onChange={setStagedMinute} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
