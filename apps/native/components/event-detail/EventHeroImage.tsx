import { Ionicons } from '@expo/vector-icons';
import { cn } from 'heroui-native';
import { Image, Text, View } from 'react-native';

import { CategoryChip } from '@/components/CategoryChip';
import { EventCollectionBadge } from '@/components/EventCollectionBadge';
import { clampFeedRatio, useImageRatio } from '@/hooks/use-image-ratio';

/** Shape of the empty placeholder, and of the hero until the cover resolves. */
const FALLBACK_HERO_RATIO = 375 / 208;

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
  // Cover art is a gig poster as often as it is a photo, so the hero takes the
  // image's own shape instead of forcing every poster into a 16:9 letterbox.
  const natural = useImageRatio(coverImageUrl);
  const ratio = coverImageUrl && natural !== null ? clampFeedRatio(natural) : FALLBACK_HERO_RATIO;

  return (
    <View style={{ aspectRatio: ratio }} className={cn('w-full relative', className)}>
      {coverImageUrl ? (
        <Image
          source={{ uri: coverImageUrl }}
          className="absolute inset-0 w-full h-full"
          resizeMode="cover"
        />
      ) : (
        <View className="absolute inset-0 w-full h-full bg-white/5 items-center justify-center">
          <Ionicons name="image-outline" size={40} color="rgba(255,255,255,0.3)" />
        </View>
      )}

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
