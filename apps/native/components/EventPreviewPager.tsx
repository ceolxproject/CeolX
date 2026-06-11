import { cn } from 'heroui-native';
import { useCallback, useState } from 'react';
import type { ListRenderItem, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { FlatList, useWindowDimensions, View } from 'react-native';

import { EventPreviewCard } from '@/components/EventPreviewCard';
import type { MapEvent } from '@/components/MapEventMarker';

type EventPreviewPagerProps = {
  events: MapEvent[];
  onDismiss: () => void;
};

/**
 * The bottom preview panel for a tapped pin. Renders the SAME EventPreviewCard
 * whether one event or several share a spot — for multiple, the cards become a
 * horizontally swipeable pager with page dots, so the layout is identical
 * across the single-event and same-location cases (Asana 1215446988595390).
 */
export function EventPreviewPager({ events, onDismiss }: EventPreviewPagerProps) {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);

  // Each page is one screen wide so paging snaps card-to-card; the card itself
  // is inset by px-4 to leave the same margins as the single-event case.
  const renderItem = useCallback<ListRenderItem<MapEvent>>(
    ({ item }) => (
      <View style={{ width }} className="px-4">
        <EventPreviewCard event={item} onDismiss={onDismiss} />
      </View>
    ),
    [width, onDismiss]
  );

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
    },
    [width]
  );

  // Single event — just the card, inset to match the multi-card page padding.
  if (events.length === 1) {
    return (
      <View className="px-4">
        <EventPreviewCard event={events[0]} onDismiss={onDismiss} />
      </View>
    );
  }

  return (
    <View>
      <FlatList
        data={events}
        keyExtractor={(event) => event.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumScrollEnd}
        renderItem={renderItem}
      />

      <View className="flex-row justify-center gap-1.5 mt-2">
        {events.map((event, i) => (
          <View
            key={event.id}
            className={cn('h-1.5 rounded-full', i === index ? 'w-4 bg-white' : 'w-1.5 bg-white/40')}
          />
        ))}
      </View>
    </View>
  );
}
