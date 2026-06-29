import { Ionicons } from '@expo/vector-icons';
import { cn } from 'heroui-native';
import { Image, Text, View } from 'react-native';

import { CategoryChip } from '@/components/CategoryChip';
import { EventCollectionBadge } from '@/components/EventCollectionBadge';
import { getMockEventImage } from '@/utils/mock-images';

interface EventHeroImageProps {
  coverImageUrl?: string;
  category: string;
  /** Name of the collection this event belongs to — shown as the top-left tag. */
  collectionName?: string | null;
  attendeeCount: number;
  className?: string;
}

export function EventHeroImage({
  coverImageUrl,
  category,
  collectionName,
  attendeeCount,
  className,
}: EventHeroImageProps) {
  return (
    <View className={cn('w-full aspect-[375/208] relative', className)}>
      <Image
        source={coverImageUrl ? { uri: coverImageUrl } : getMockEventImage('hero')}
        className="absolute inset-0 w-full h-full"
        resizeMode="cover"
      />

      {/* Collection tag — top-left over the cover (category sits bottom-left) */}
      {collectionName ? (
        <View className="absolute top-3 left-4">
          <EventCollectionBadge name={collectionName} />
        </View>
      ) : null}

      {/* Category + attendee badges, aligned on one line over the image */}
      <View className="absolute bottom-3 left-4 right-4 flex-row items-center justify-between">
        <CategoryChip category={category} size="md" />
        {attendeeCount > 0 && (
          <View className="flex-row items-center bg-white rounded-full px-2 py-1.5 gap-1">
            <Ionicons name="people" size={10} color="#000" />
            <Text className="text-[10px] font-semibold text-black font-urbanist">
              {attendeeCount} {attendeeCount === 1 ? 'person' : 'people'} attending
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
