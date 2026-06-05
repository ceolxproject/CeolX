import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Marker } from 'react-native-maps';

import { CATEGORY_ICONS, CATEGORY_LABELS } from '@CeolX/shared';

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

  // Skip the selection effect on the very first render — initial settling is
  // driven by the image's onLoad instead (so slow remote images still get
  // captured no matter how long they take).
  const isFirstRender = useRef(true);

  // The cover image has painted — freeze the snapshot.
  const handleImageLoad = useCallback(() => setTracksViewChanges(false), []);

  // Selection flips the pin's visuals (size 44→56, glow ring, title label).
  // The cached image won't re-fire onLoad, so a short timer is the only signal
  // the transition has finished: re-enable native snapshotting, then settle
  // back to frozen after 500ms — long enough to capture the glow ring on
  // slower devices, short enough to avoid lingering per-frame rasterization.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setTracksViewChanges(true);
    const timer = setTimeout(() => setTracksViewChanges(false), 500);
    return () => clearTimeout(timer);
  }, [isSelected]);

  return (
    <Marker
      coordinate={{ latitude: event.lat, longitude: event.lng }}
      tracksViewChanges={tracksViewChanges}
    >
      <Pressable onPress={() => onSelect(event)}>
        <View className="items-center">
          <MapEventPin
            type="single"
            coverImageUrl={event.coverImageUrl}
            category={CATEGORY_LABELS[event.category] ?? event.category}
            categoryIcon={CATEGORY_ICONS[event.category]}
            isSelected={isSelected}
            onImageLoad={handleImageLoad}
          />
          {isSelected ? (
            <View className="mt-1 bg-[rgba(255,255,255,0.92)] px-2 py-[3px] rounded-[10px] max-w-[140px]">
              <Text className="text-[11px] text-[#080808] font-semibold" numberOfLines={1}>
                {event.title}
              </Text>
            </View>
          ) : null}
        </View>
      </Pressable>
    </Marker>
  );
}

export const MapEventMarker = memo(MapEventMarkerComponent);
