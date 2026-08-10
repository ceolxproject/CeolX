import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import type { EdgeInsets } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TAB_BAR_HEIGHT } from '@/constants/layout';
import {
  MAP_HEADER_HEIGHT,
  MAP_SEARCH_BAR_GAP,
  MAP_SEARCH_BAR_HEIGHT,
} from '@/constants/map-layout';
import type { MapPointer } from '@/hooks/use-map-pointers';

// Wide enough for the longest realistic label ("3 events · 150km") at 12px.
const POINTER_WIDTH = 150;
const POINTER_HEIGHT = 34;
/** Stops a due-north or due-east ray dividing by a zero component. */
const MIN_RAY_COMPONENT = 1e-6;

/** The rectangle pointers are pinned to — the screen minus the floating chrome. */
type EdgeBox = { centerX: number; centerY: number; halfWidth: number; halfHeight: number };

function edgeBox(width: number, height: number, insets: EdgeInsets): EdgeBox {
  // Header + search bar above; tab bar and the recenter button's row below.
  const top =
    insets.top +
    MAP_HEADER_HEIGHT +
    MAP_SEARCH_BAR_GAP +
    MAP_SEARCH_BAR_HEIGHT +
    12 +
    POINTER_HEIGHT;
  const bottom = insets.bottom + TAB_BAR_HEIGHT + 16 + POINTER_HEIGHT;
  const centerX = width / 2;
  return {
    centerX,
    centerY: (top + (height - bottom)) / 2,
    halfWidth: centerX - (POINTER_WIDTH / 2 + 12),
    halfHeight: (height - bottom - top) / 2,
  };
}

/** Top-left offset of the pill where the bearing ray leaves the box. */
function edgeOffset(bearingDeg: number, box: EdgeBox): { left: number; top: number } {
  const radians = (bearingDeg * Math.PI) / 180;
  const sin = Math.sin(radians);
  const cos = Math.cos(radians);
  // Whichever edge, vertical or horizontal, the ray reaches first.
  const ray = Math.min(
    box.halfHeight / Math.max(Math.abs(cos), MIN_RAY_COMPONENT),
    box.halfWidth / Math.max(Math.abs(sin), MIN_RAY_COMPONENT)
  );
  return {
    left: box.centerX + ray * sin - POINTER_WIDTH / 2,
    top: box.centerY - ray * cos - POINTER_HEIGHT / 2,
  };
}

/**
 * Kilometres — Ireland and the rest of the EU are metric (the UK is the lone
 * miles holdout, and V1 is an Ireland-only launch).
 *
 * Coarser than the shared formatDistance on purpose: this is a "pan this way"
 * hint, so "45km" reads better than a falsely precise "44.7km". Sub-10km keeps
 * a decimal, where the difference is actually meaningful on foot.
 */
function shortDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)}m`;
  if (km < 10) return `${km.toFixed(1)}km`;
  return `${Math.round(km)}km`;
}

function pointerLabel({ count, distanceKm }: MapPointer): string {
  const noun = count === 1 ? '1 event' : `${count} events`;
  // A bare distance never says WHAT is over there, and a bare count never says
  // how far. The pill is the whole message, so it carries both.
  return distanceKm === null ? noun : `${noun} · ${shortDistance(distanceKm)}`;
}

function pointerA11yLabel({ count, distanceKm, compass }: MapPointer): string {
  const noun = count === 1 ? 'event' : 'events';
  const where =
    distanceKm === null ? `to the ${compass}` : `${shortDistance(distanceKm)} ${compass}`;
  return `${count} ${noun}, ${where}. Tap to view.`;
}

type MapEdgePointersProps = {
  pointers: MapPointer[];
  onSelect: (pointer: MapPointer) => void;
};

/**
 * Arrows pinned to the edge of the map pointing at events that were loaded but
 * fall outside the visible region. Without these the map reads as "there is
 * nothing here" while pins sit just off-screen.
 *
 * Rendered as a sibling of MapView, not a child: the map is force-remounted via
 * its `key` whenever the resolved location changes, and these must survive that.
 */
export function MapEdgePointers({ pointers, onSelect }: MapEdgePointersProps) {
  const { width, height } = useWindowDimensions();
  const box = edgeBox(width, height, useSafeAreaInsets());

  // A very short screen (or a huge inset) collapses the box — bail rather than
  // stacking every arrow on one pixel.
  if (box.halfWidth <= 0 || box.halfHeight <= 0) return null;

  return (
    <View pointerEvents="box-none" className="absolute inset-0 z-10">
      {pointers.map((pointer) => (
        <Animated.View
          key={pointer.id}
          entering={FadeIn.duration(220)}
          style={{
            position: 'absolute',
            width: POINTER_WIDTH,
            height: POINTER_HEIGHT,
            ...edgeOffset(pointer.bearingDeg, box),
          }}
        >
          <Pressable
            onPress={() => onSelect(pointer)}
            accessibilityRole="button"
            accessibilityLabel={pointerA11yLabel(pointer)}
            hitSlop={8}
            className="flex-1 flex-row items-center justify-center gap-1.5 rounded-full bg-[rgba(43,43,43,0.95)] px-2.5"
          >
            <Ionicons
              name="arrow-up"
              size={14}
              color="#C8FF2F"
              style={{ transform: [{ rotate: `${pointer.bearingDeg}deg` }] }}
            />
            <Text className="text-white text-[12px] font-semibold" numberOfLines={1}>
              {pointerLabel(pointer)}
            </Text>
          </Pressable>
        </Animated.View>
      ))}
    </View>
  );
}
