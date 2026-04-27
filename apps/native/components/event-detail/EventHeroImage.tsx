import { Ionicons } from '@expo/vector-icons';
import { cn } from 'heroui-native';
import { Image, Text, View } from 'react-native';

import { getMockEventImage } from '@/utils/mock-images';

interface EventHeroImageProps {
  coverImageUrl?: string;
  attendeeCount: number;
  className?: string;
}

export function EventHeroImage({ coverImageUrl, attendeeCount, className }: EventHeroImageProps) {
  return (
    <View className={cn('w-full aspect-[375/208] relative', className)}>
      {coverImageUrl ? (
        <Image
          source={{ uri: coverImageUrl }}
          className="absolute inset-0 w-full h-full"
          resizeMode="cover"
        />
      ) : (
        <Image
          source={getMockEventImage('hero')}
          className="absolute inset-0 w-full h-full"
          resizeMode="cover"
        />
      )}

      {attendeeCount > 0 && (
        <View className="absolute bottom-3 left-4 flex-row items-center bg-white rounded-full px-2 py-1 gap-1">
          <Ionicons name="people" size={10} color="#000" />
          <Text className="text-[10px] font-semibold text-black font-urbanist">
            {attendeeCount} people are attending
          </Text>
        </View>
      )}
    </View>
  );
}
