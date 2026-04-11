import { Ionicons } from '@expo/vector-icons';
import { cn } from 'heroui-native';
import { Image, Pressable, Text, View } from 'react-native';

import { CATEGORY_ICONS, CATEGORY_LABELS } from '@CeolX/shared';

import type { RelatedEvent } from '@/types/event-detail';

interface CollectionEventCardProps {
  event: RelatedEvent;
  onPress: () => void;
  className?: string;
}

export function CollectionEventCard({ event, onPress, className }: CollectionEventCardProps) {
  const categoryLabel = CATEGORY_LABELS[event.category] ?? event.category;
  const categoryIcon = CATEGORY_ICONS[event.category] ?? '🎵';
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
            <Text className="text-4xl">🎵</Text>
          </View>
        )}

        {/* Category badge */}
        <View className="absolute top-3 left-3 bg-[#080808] rounded-xl px-2 py-1.5">
          <Text className="text-[12px] text-green-10 font-semibold tracking-wide uppercase font-sans">
            {categoryLabel}
          </Text>
        </View>

        {/* Bottom pills */}
        <View className="absolute bottom-3 left-3 right-3 flex-row items-center justify-between">
          <View className="flex-row items-center bg-green-10 rounded-full px-2 h-4 gap-0.5">
            <Text className="text-[11px]">{categoryIcon}</Text>
            <Text className="text-[11px] font-semibold text-black font-sans">{categoryLabel}</Text>
          </View>
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
