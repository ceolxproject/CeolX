import { Ionicons } from '@expo/vector-icons';
import { cn } from 'heroui-native';
import { Image, Text, View } from 'react-native';

interface EventHeroImageProps {
  coverImageUrl?: string;
  attendeeCount: number;
  className?: string;
}

export function EventHeroImage({ coverImageUrl, attendeeCount, className }: EventHeroImageProps) {
  return (
    <View className={cn('w-full aspect-[335/208] relative', className)}>
      {coverImageUrl ? (
        <Image
          source={{ uri: coverImageUrl }}
          className="absolute inset-0 w-full h-full"
          resizeMode="cover"
        />
      ) : (
        <View className="absolute inset-0 w-full h-full bg-white/5 items-center justify-center">
          <Text className="text-5xl">🎵</Text>
        </View>
      )}

      {attendeeCount > 0 && (
        <View className="absolute bottom-3 left-4 flex-row items-center bg-white rounded-full px-2 py-1 gap-1">
          <Ionicons name="people" size={10} color="#000" />
          <Text className="text-[10px] font-semibold text-black font-sans">
            {attendeeCount} people are attending
          </Text>
        </View>
      )}
    </View>
  );
}
