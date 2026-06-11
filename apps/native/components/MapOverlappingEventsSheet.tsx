import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';

import { CATEGORY_LABELS } from '@CeolX/shared';

import type { MapEvent } from '@/components/MapEventMarker';
import { getMockEventImage } from '@/utils/mock-images';

type MapOverlappingEventsSheetProps = {
  events: MapEvent[];
  onClose: () => void;
};

/**
 * Bottom sheet listing events that sit at (near-)identical coordinates — the
 * case where zooming can never separate the pins, so tapping the cluster would
 * otherwise just cycle through the stacked markers. Lets the user pick which
 * event to open instead (Asana 1215446988595390).
 */
export function MapOverlappingEventsSheet({ events, onClose }: MapOverlappingEventsSheetProps) {
  const router = useRouter();

  const openEvent = (id: string) => {
    onClose();
    router.push(`/(app)/(tabs)/map/event/${id}`);
  };

  return (
    <View className="absolute inset-0 z-20 justify-end">
      {/* Backdrop — tap outside to dismiss */}
      <Pressable className="absolute inset-0 bg-black/40" onPress={onClose} />

      {/* paddingBottom clears the floating tab bar (~80px) so the last row is tappable */}
      <View
        className="bg-white rounded-t-3xl pt-3 px-4 pb-[96px]"
        style={{ boxShadow: '0 -4px 16px rgba(0,0,0,0.18)' }}
      >
        <View className="self-center w-10 h-1 rounded-full bg-[#E0E0E0] mb-3" />

        <View className="flex-row items-center justify-between mb-1">
          <Text className="text-[16px] font-semibold text-[#1A1A1A]">
            {events.length} events here
          </Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={22} color="#8D8D8D" />
          </Pressable>
        </View>

        <ScrollView className="max-h-[320px]" showsVerticalScrollIndicator={false}>
          {events.map((event) => (
            <Pressable
              key={event.id}
              className="flex-row items-center gap-3 py-3 border-b border-[#F0F0F0]"
              onPress={() => openEvent(event.id)}
            >
              <Image
                source={
                  event.coverImageUrl ? { uri: event.coverImageUrl } : getMockEventImage(event.id)
                }
                className="w-12 h-12 rounded-[10px] bg-[#E8E8E8]"
              />
              <View className="flex-1 gap-0.5">
                <Text className="text-[15px] font-semibold text-[#1A1A1A]" numberOfLines={1}>
                  {event.title}
                </Text>
                <Text className="text-[13px] text-[#8D8D8D]" numberOfLines={1}>
                  {CATEGORY_LABELS[event.category] ?? event.category} ·{' '}
                  {event.venueAddress ?? 'Venue TBA'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#C4C4C4" />
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}
