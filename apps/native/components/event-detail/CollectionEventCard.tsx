import { Ionicons } from '@expo/vector-icons';
import { cn } from 'heroui-native';
import { Image, Pressable, Text, View } from 'react-native';

import { CategoryChip } from '@/components/CategoryChip';
import { EventCollectionBadge } from '@/components/EventCollectionBadge';
import type { RelatedEvent } from '@/types/event-detail';

interface CollectionEventCardProps {
  event: RelatedEvent;
  /**
   * Name of the collection these related events belong to. Passed down from the
   * parent event detail (all "Explore the collection" cards share one
   * collection), shown as the top-left tag. Hidden when absent.
   */
  collectionName?: string | null;
  onPress: () => void;
  className?: string;
}

export function CollectionEventCard({
  event,
  collectionName,
  onPress,
  className,
}: CollectionEventCardProps) {
  const formattedDate = formatCardDate(event.dateStart);

  return (
    <Pressable
      onPress={onPress}
      className={cn(
        'w-[335px] rounded-2xl border border-[rgba(141,141,141,0.4)] bg-[rgba(141,141,141,0.1)] overflow-hidden active:opacity-90',
        className
      )}
    >
      {/* Cover image */}
      <View className="h-[208px] relative rounded-t-2xl overflow-hidden">
        {event.coverImageUrl ? (
          <Image
            source={{ uri: event.coverImageUrl }}
            className="absolute inset-0 w-full h-full"
            resizeMode="cover"
          />
        ) : (
          <View className="absolute inset-0 w-full h-full bg-white/5 items-center justify-center">
            <Ionicons name="image-outline" size={40} color="rgba(255,255,255,0.3)" />
          </View>
        )}

        {/* Collection tag — top-left (category lives in the bottom pill below) */}
        {collectionName ? (
          <View className="absolute top-3 left-3">
            <EventCollectionBadge name={collectionName} />
          </View>
        ) : null}

        {/* Bottom pills */}
        <View className="absolute bottom-3 left-3 right-3 flex-row items-center justify-between">
          <CategoryChip category={event.category} />
        </View>
      </View>

      {/* Content */}
      <View className="px-3 pt-3 pb-4">
        <Text className="text-2xl font-semibold text-white font-sans" numberOfLines={1}>
          {event.title}
        </Text>
        <View className="flex-row items-start gap-2 mt-2">
          <View className="flex-1 flex-row items-center gap-1">
            <Ionicons name="location-outline" size={12} color="rgba(255,255,255,0.6)" />
            <Text className="text-xs font-semibold text-white/60 font-sans" numberOfLines={1}>
              {event.venueAddress ?? 'Location TBC'}
            </Text>
          </View>
          <View className="flex-row items-center gap-1">
            <Ionicons name="calendar-outline" size={12} color="rgba(255,255,255,0.6)" />
            <Text className="text-xs font-semibold text-white/60 font-sans" numberOfLines={1}>
              {formattedDate}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function formatCardDate(dateStart: string): string {
  const d = new Date(dateStart);
  const month = d.toLocaleString('en-IE', { month: 'short' });
  const day = d.getDate();
  const time = d.toLocaleString('en-IE', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${month} ${day}, ${time}`;
}
