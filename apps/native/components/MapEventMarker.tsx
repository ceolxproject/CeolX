import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Text, View, type LayoutChangeEvent } from 'react-native';
import { Marker } from 'react-native-maps';

import { CATEGORY_LABELS } from '@CeolX/shared';

import { MapEventPin } from '@/components/MapEventPin';

export type MapEvent = {
  id: string;
  title: string;
  lat: number;
  lng: number;
  category: string;
  dateStart: string;
  dateEnd?: string;
  venueAddress?: string;
  coverImageUrl?: string;
  distanceMeters?: number;
};

type MapEventMarkerProps = {
  event: MapEvent;
  isSelected: boolean;
  onSelect: (event: MapEvent) => void;
};

/**
 * A single event/venue pin on the map.
 *
 * Memoized so unrelated MapScreen state changes (filter sheet, search text,
 * banner) don't re-render every pin. Owns its own `tracksViewChanges` so the
 * native marker only re-rasterizes when there's actual visual work to capture
 * — the cover image painting, or a selection transition — and stays frozen
 * (cheap) the rest of the time.
 */
function MapEventMarkerComponent({ event, isSelected, onSelect }: MapEventMarkerProps) {
  // `true` = the native map re-snapshots this marker's custom view every frame
  // (correct but expensive). `false` = frozen single snapshot (cheap). We want
  // it true only while something visual is still settling, then false.
  const [tracksViewChanges, setTracksViewChanges] = useState(true);

  // Skip the first `onLayout` (initial mount) — initial settling is driven by
  // the mount fallback / image onLoad instead; layout-driven freezes are only
  // for later size changes (e.g. the selection transition).
  const isFirstRender = useRef(true);

  // One shared timer across all freeze triggers (mount, image load, selection)
  // so re-arming cancels the previous pending freeze instead of leaking timers.
  const freezeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Re-enable native snapshotting, then freeze again after `delay`. Deferring
  // the freeze is essential on Android: the marker's custom view is flattened
  // to a bitmap, and freezing BEFORE that bitmap has captured the painted pin
  // leaves a blank snapshot (the pin renders as an empty white circle until a
  // remount re-captures it). The trailing timer guarantees the freeze lands
  // after the view is actually drawn.
  const scheduleFreeze = useCallback((delay: number) => {
    if (freezeTimer.current) clearTimeout(freezeTimer.current);
    setTracksViewChanges(true);
    freezeTimer.current = setTimeout(() => setTracksViewChanges(false), delay);
  }, []);

  // Mount fallback — freeze even if the cover image never fires onLoad (e.g.
  // load error, or a cached local image whose onLoad is unreliable on Android).
  useEffect(() => {
    scheduleFreeze(1000);
    return () => {
      if (freezeTimer.current) clearTimeout(freezeTimer.current);
    };
  }, [scheduleFreeze]);

  // The cover image painted — give the native snapshot a short beat to capture
  // the composited view, then freeze.
  const handleImageLoad = useCallback(() => scheduleFreeze(250), [scheduleFreeze]);

  // Selection flips the pin's visuals (size 44→56, glow ring, title label) and
  // grows the marker view downward as the title appears. react-native-maps
  // derives the native touch frame from the frozen bitmap's size, so freezing
  // before the grown layout is measured leaves the hit region sized to the
  // circle alone — taps on the title region then fall outside it. Drive the
  // re-freeze off the container's actual `onLayout` (fires once the title has
  // been laid out) instead of racing a fixed timer, guaranteeing the snapshot —
  // and thus the touch frame — covers both the circle image and the title.
  const handleLayout = useCallback(
    (_event: LayoutChangeEvent) => {
      if (isFirstRender.current) {
        isFirstRender.current = false;
        return;
      }
      scheduleFreeze(250);
    },
    [scheduleFreeze]
  );

  return (
    <Marker
      coordinate={{ latitude: event.lat, longitude: event.lng }}
      tracksViewChanges={tracksViewChanges}
      // Touch MUST be handled by the Marker's own onPress: on Android the custom
      // child view is a static bitmap, so an inner <Pressable> never receives
      // taps. This is why pin taps worked on iOS (live subview) but were dead on
      // Android. Mirrors MapClusterMarker, which is tappable on both platforms.
      onPress={() => onSelect(event)}
    >
      <View className="items-center" onLayout={handleLayout}>
        <MapEventPin
          type="single"
          coverImageUrl={event.coverImageUrl}
          category={CATEGORY_LABELS[event.category] ?? event.category}
          categoryKey={event.category}
          isSelected={isSelected}
          onImageLoad={handleImageLoad}
        />
        {isSelected ? (
          // Absolute overlay below the pin: like the badge, it must not grow the
          // marker's layout box, or it would push the circle out of the iOS hit
          // frame and make the (now-larger) selected pin untappable.
          <View
            style={{ position: 'absolute', top: '100%', marginTop: 4 }}
            className="bg-[rgba(255,255,255,0.92)] px-2 py-[3px] rounded-[10px] max-w-[140px]"
          >
            <Text className="text-[11px] text-[#080808] font-semibold" numberOfLines={1}>
              {event.title}
            </Text>
          </View>
        ) : null}
      </View>
    </Marker>
  );
}

export const MapEventMarker = memo(MapEventMarkerComponent);
