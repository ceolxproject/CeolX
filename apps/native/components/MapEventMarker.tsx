import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
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
  onSelect: (event: MapEvent) => void;
};

/**
 * A single event/venue pin on the map.
 *
 * Memoized so unrelated MapScreen state changes (filter sheet, search text,
 * banner) don't re-render every pin. Owns its own `tracksViewChanges` so the
 * native marker only re-rasterizes when there's actual visual work to capture
 * — the cover image painting — and stays frozen (cheap) the rest of the time.
 */
function MapEventMarkerComponent({ event, onSelect }: MapEventMarkerProps) {
  // `true` = the native map re-snapshots this marker's custom view every frame
  // (correct but expensive). `false` = frozen single snapshot (cheap). We want
  // it true only while something visual is still settling, then false.
  const [tracksViewChanges, setTracksViewChanges] = useState(true);

  // One shared timer across all freeze triggers (mount, image load)
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
      {/* collapsable=false: without it, Android New-Arch flattens this
          background-less view and the marker snapshots to clipped bounds
          (pin renders as a crescent). */}
      <View collapsable={false} className="items-center">
        <MapEventPin
          type="single"
          coverImageUrl={event.coverImageUrl}
          category={CATEGORY_LABELS[event.category] ?? event.category}
          categoryKey={event.category}
          onImageLoad={handleImageLoad}
        />
      </View>
    </Marker>
  );
}

export const MapEventMarker = memo(MapEventMarkerComponent);
