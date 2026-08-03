import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ─── Constants ───────────────────────────────────────────────────────────────

const ITEM_HEIGHT = 48;

// Reusable absoluteFillObject equivalent without importing StyleSheet everywhere
const absoluteFill = StyleSheet.absoluteFillObject;
const VISIBLE_ITEMS = 5; // Must be odd so the centre item is the selection

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

// ─── WheelColumn ─────────────────────────────────────────────────────────────

// The wheels deliberately do NOT loop past 23:59 / 59 → 00. That was tried by
// stacking copies of the list into a virtualised FlatList and recentring after
// every scroll, and it broke the minute wheel: the highlight is driven by React
// state while the committed value is read back from the scroll offset, so the two
// desynced and minutes became unsettable — the wheel showed :08 and Done wrote
// :00. The offset juggling also depended on onMomentumScrollBegin always being
// followed by onMomentumScrollEnd, which iOS does not guarantee with
// snapToInterval; when it isn't, the scroll guard latches and no further change
// is ever committed. Reverted, since being able to set a time matters more than
// wrapping past midnight. If looping is wanted again, use
// @react-native-community/datetimepicker rather than rebuilding this — it loops
// natively and fixes the accessibility gap below.
//
// Known limitation: this custom wheel is not screen-reader operable (TalkBack /
// VoiceOver). Kept for the dark drum-roller design. To close the gap, add
// accessibilityRole="adjustable" with increment/decrement actions, or swap in
// @react-native-community/datetimepicker.
type WheelProps = {
  items: string[];
  value: number;
  onChange: (index: number) => void;
};

function WheelColumn({ items, value, onChange }: WheelProps) {
  const scrollRef = useRef<ScrollView>(null);
  // Tracks whether a user-initiated scroll is in progress so external value
  // changes (e.g. modal opening with a new time) don't fight the scroll.
  const isUserScrolling = useRef(false);
  const padding = Math.floor(VISIBLE_ITEMS / 2) * ITEM_HEIGHT;

  // Scroll to new position whenever value is updated externally
  useEffect(() => {
    if (!isUserScrolling.current) {
      scrollRef.current?.scrollTo({ y: value * ITEM_HEIGHT, animated: false });
    }
  }, [value]);

  const commit = (offsetY: number) => {
    isUserScrolling.current = false;
    const index = Math.round(offsetY / ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(items.length - 1, index));
    onChange(clamped);
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

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        contentContainerStyle={{ paddingVertical: padding }}
        onScrollBeginDrag={() => {
          isUserScrolling.current = true;
        }}
        onMomentumScrollEnd={(e) => commit(e.nativeEvent.contentOffset.y)}
        // onScrollEndDrag fires when drag ends without momentum (slow drag)
        onScrollEndDrag={(e) => commit(e.nativeEvent.contentOffset.y)}
      >
        {items.map((label, i) => {
          const isCentre = i === value;
          return (
            <View
              key={label}
              style={{ height: ITEM_HEIGHT, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text
                style={{
                  fontSize: isCentre ? 22 : 18,
                  fontWeight: isCentre ? '700' : '400',
                  color: isCentre ? '#ffffff' : 'rgba(255,255,255,0.28)',
                  letterSpacing: 0.5,
                }}
              >
                {label}
              </Text>
            </View>
          );
        })}
      </ScrollView>
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
          ScrollView wheel columns and break scrolling. */}
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
