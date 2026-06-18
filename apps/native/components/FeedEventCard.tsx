import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import type { FeedEvent } from '@CeolX/shared';

import { BaseEventCard } from './BaseEventCard';
import { EventCollectionBadge } from './EventCollectionBadge';

interface FeedEventCardProps {
  event: FeedEvent;
  onPress: () => void;
  isArtist?: boolean;
  className?: string;
}

export function FeedEventCard({ event, onPress, className }: FeedEventCardProps) {
  return (
    <BaseEventCard
      title={event.title}
      coverImageUrl={event.coverImageUrl ?? null}
      dateStart={event.dateStart}
      dateEnd={event.dateEnd}
      category={event.category}
      venueAddress={event.venueAddress ?? null}
      onPress={onPress}
      className={className}
      topLeftBadge={
        event.collectionName ? <EventCollectionBadge name={event.collectionName} /> : undefined
      }
      bottomRightOverlay={
        event.joinedCount > 0 ? (
          <View className="flex-row items-center bg-white rounded-full px-2 h-4 gap-0.5">
            <Ionicons name="people-outline" size={10} color="#000" />
            <Text className="text-[10px] font-semibold text-black font-urbanist">
              {event.joinedCount} Joined
            </Text>
          </View>
        ) : undefined
      }
    />
  );
}
