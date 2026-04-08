import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Image, Pressable, Text, View } from 'react-native';

interface EventPreviewCardProps {
  event: {
    id: string;
    title: string;
    category: string;
    dateStart: string; // ISO 8601
    venueAddress?: string;
    coverImageUrl?: string;
  };
  onDismiss?: () => void;
}

export function EventPreviewCard({ event, onDismiss }: EventPreviewCardProps) {
  const router = useRouter();

  return (
    <View
      className="bg-white rounded-2xl p-[14px] gap-[14px]"
      style={{ boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)' }}
    >
      {/* Top row: thumbnail + info + location icon */}
      <Pressable
        className="flex-row items-center gap-3"
        onPress={() => router.push(`/(app)/(tabs)/map/event/${event.id}`)}
      >
        {event.coverImageUrl ? (
          <Image
            source={{ uri: event.coverImageUrl }}
            className="w-12 h-12 rounded-[10px] bg-[#E8E8E8]"
          />
        ) : (
          <View className="w-12 h-12 rounded-[10px] bg-blue-2 items-center justify-center">
            <Text className="text-xl">🎵</Text>
          </View>
        )}
        <View className="flex-1 gap-0.5">
          <Text className="text-[15px] font-semibold text-[#1A1A1A]" numberOfLines={1}>
            {event.title}
          </Text>
          <Text className="text-[13px] text-[#8D8D8D]" numberOfLines={1}>
            {event.venueAddress ?? 'Venue TBA'}
          </Text>
        </View>
        <Ionicons name="location-sharp" size={22} color="#662FFF" />
      </Pressable>

      {/* Action buttons */}
      <View className="flex-row gap-[10px]">
        <Pressable
          className="flex-1 h-11 rounded-full border-[1.5px] border-[#E0E0E0] items-center justify-center"
          onPress={onDismiss}
        >
          <Text className="text-[14px] font-semibold text-[#1A1A1A] tracking-[0.5px]">CANCEL</Text>
        </Pressable>
        <Pressable
          className="flex-1 h-11 rounded-full bg-[#662FFF] items-center justify-center"
          onPress={() => router.push(`/(app)/(tabs)/map/event/${event.id}`)}
        >
          <Text className="text-[14px] font-semibold text-white tracking-[0.5px]">SAVE</Text>
        </Pressable>
      </View>
    </View>
  );
}
