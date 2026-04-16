import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import type { FeedEvent } from '@CeolX/shared';

import { BaseEventCard } from './BaseEventCard';

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
        event.collectionName ? (
          <View className="rounded-xl px-2 py-1.5" style={{ backgroundColor: 'rgba(8,8,8,0.85)' }}>
            <Text className="text-[12px] text-[#C8FF2F] font-semibold tracking-wide font-urbanist">
              {event.collectionName}
            </Text>
          </View>
        ) : undefined
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
