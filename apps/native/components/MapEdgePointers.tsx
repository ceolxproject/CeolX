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

const POINTER_HEIGHT = 34;
/** Breathing room from the screen edge, and between two stacked pills. */
const EDGE_PADDING = 12;
const ROW_GAP = 8;
/** Stops a due-north or due-east ray dividing by a zero component. */
const MIN_RAY_COMPONENT = 1e-6;

/**
 * Rough pixel width of a rendered pill, from its label.
 *
 * Deliberately an estimate rather than an onLayout measurement: layout arrives a
 * frame late, so measuring would show the arrows overlapping and then jump. The
 * constant covers icon + gap + horizontal padding + border, and it is only ever
 * used to keep pills on screen and off each other — never to size one.
 */
function estimatePillWidth(label: string): number {
  return 56 + label.length * 6.8;
}

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
    POINTER_HEIGHT / 2;
  const bottom = insets.bottom + TAB_BAR_HEIGHT + 16 + POINTER_HEIGHT / 2;
  const centerX = width / 2;
  return {
    centerX,
    centerY: (top + (height - bottom)) / 2,
    halfWidth: centerX - EDGE_PADDING,
    halfHeight: (height - bottom - top) / 2,
  };
}

/** Centre point at which the bearing ray leaves the box. */
function edgePoint(bearingDeg: number, box: EdgeBox): { x: number; y: number } {
  const radians = (bearingDeg * Math.PI) / 180;
  const sin = Math.sin(radians);
  const cos = Math.cos(radians);
  // Whichever edge, vertical or horizontal, the ray reaches first.
  const ray = Math.min(
    box.halfHeight / Math.max(Math.abs(cos), MIN_RAY_COMPONENT),
    box.halfWidth / Math.max(Math.abs(sin), MIN_RAY_COMPONENT)
  );
  return { x: box.centerX + ray * sin, y: box.centerY - ray * cos };
}

type Placement = { pointer: MapPointer; left: number; top: number; width: number };

/**
 * Places each pill on its bearing, then pushes any that collide downwards.
 *
 * Sector snapping separates arrows in *adjacent* directions, but not opposite
 * ones: east and west both leave the box on the vertical mid-line, so they share
 * a row, and once a label is wide enough ("1 event · 13km from you") the two meet
 * in the middle of a narrow screen. No fixed pill width fixes that — it just
 * moves the breaking point to a smaller phone.
 */
function layoutPointers(
  pointers: MapPointer[],
  box: EdgeBox,
  screenWidth: number,
  label: (p: MapPointer) => string
): Placement[] {
  const placed: Placement[] = [];

  for (const pointer of pointers) {
    const { x, y } = edgePoint(pointer.bearingDeg, box);
    const width = estimatePillWidth(label(pointer));
    // Centre on the ray, then keep the whole pill on screen.
    const left = Math.max(
      EDGE_PADDING,
      Math.min(x - width / 2, screenWidth - EDGE_PADDING - width)
    );

    let top = y - POINTER_HEIGHT / 2;
    // Nudge down until this pill clears every one already placed. Bounded by the
    // pointer count, so it always terminates.
    let guard = 0;
    while (
      guard < placed.length &&
      placed.some(
        (other) =>
          Math.abs(other.top - top) < POINTER_HEIGHT + ROW_GAP &&
          left < other.left + other.width &&
          other.left < left + width
      )
    ) {
      top += POINTER_HEIGHT + ROW_GAP;
      guard += 1;
    }

    placed.push({ pointer, left, top, width });
  }

  return placed;
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

function pointerLabel({ count, distanceKm, distanceFromUser }: MapPointer): string {
  const noun = count === 1 ? '1 event' : `${count} events`;
  // A bare distance never says WHAT is over there, and a bare count never says
  // how far. The pill is the whole message, so it carries both.
  if (distanceKm === null) return noun;
  // "from you" only when it is genuinely from the user. After a search the
  // distance is from the searched place, and claiming otherwise would mislead.
  const suffix = distanceFromUser ? ' from you' : '';
  return `${noun} · ${shortDistance(distanceKm)}${suffix}`;
}

function pointerA11yLabel({ count, distanceKm, compass, distanceFromUser }: MapPointer): string {
  const noun = count === 1 ? 'event' : 'events';
  const where =
    distanceKm === null
      ? `to the ${compass}`
      : `${shortDistance(distanceKm)} ${compass}${distanceFromUser ? ' of you' : ''}`;
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
      {layoutPointers(pointers, box, width, pointerLabel).map(({ pointer, left, top }) => (
        <Animated.View
          key={pointer.id}
          entering={FadeIn.duration(220)}
          // Positioned by its resolved top-left; the pill still hugs its own
          // label, so the estimated width is only used for placement.
          style={{
            position: 'absolute',
            left,
            top,
            height: POINTER_HEIGHT,
            alignItems: 'flex-start',
            justifyContent: 'center',
          }}
        >
          <Pressable
            onPress={() => onSelect(pointer)}
            accessibilityRole="button"
            accessibilityLabel={pointerA11yLabel(pointer)}
            hitSlop={8}
            // Lime on black, the same pairing as the pin's category caption and
            // the cluster badge. A dark pill was the one thing on the map not
            // speaking the app's language, and it sank into a dark map. The white
            // ring echoes the 2px border on the pin circle so the shape stays
            // readable over pale terrain as well as dark.
            className="flex-row items-center gap-1.5 rounded-full bg-[#C8FF2F] px-3 py-1.5"
            style={{
              borderWidth: 2,
              borderColor: '#FFFFFF',
              shadowColor: '#000000',
              shadowOpacity: 0.35,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 2 },
              elevation: 5,
            }}
          >
            <Ionicons
              name="navigate"
              size={14}
              color="#000000"
              // `navigate` already points north-east at rest, so cancel that
              // before applying the bearing. Fixed width + centred so a rotated
              // glyph cannot nudge the label off-centre.
              style={{
                width: 14,
                textAlign: 'center',
                transform: [{ rotate: `${pointer.bearingDeg - 45}deg` }],
              }}
            />
            <Text
              className="text-black text-[12px]"
              style={{ fontFamily: 'Urbanist_700Bold' }}
              numberOfLines={1}
            >
              {pointerLabel(pointer)}
            </Text>
          </Pressable>
        </Animated.View>
      ))}
    </View>
  );
}
