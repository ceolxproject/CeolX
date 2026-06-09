import { Ionicons } from '@expo/vector-icons';
import { cn } from 'heroui-native';
import { Image, Text, View } from 'react-native';

import { CategoryBadge } from './CategoryBadge';

import { getMockEventImage } from '@/utils/mock-images';

interface EventHeroImageProps {
  coverImageUrl?: string;
  category: string;
  attendeeCount: number;
  className?: string;
}

export function EventHeroImage({
  coverImageUrl,
  category,
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

      {/* Category + attendee badges, aligned on one line over the image */}
      <View className="absolute bottom-3 left-4 right-4 flex-row items-center justify-between">
        <CategoryBadge category={category} />
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
