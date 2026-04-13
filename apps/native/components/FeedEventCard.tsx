import { Ionicons } from '@expo/vector-icons';
import { cn } from 'heroui-native';
import { Image, Pressable, Text, View } from 'react-native';

import type { FeedEvent } from '@CeolX/shared';
import { CATEGORY_ICONS, CATEGORY_LABELS } from '@CeolX/shared';

interface FeedEventCardProps {
  event: FeedEvent;
  onPress: () => void;
  isArtist?: boolean;
  className?: string;
}

export function FeedEventCard({
  event,
  onPress,
  isArtist: _isArtist,
  className,
}: FeedEventCardProps) {
  const categoryLabel =
    CATEGORY_LABELS[event.category as keyof typeof CATEGORY_LABELS] ?? event.category;
  const categoryIcon = CATEGORY_ICONS[event.category as keyof typeof CATEGORY_ICONS] ?? '🎵';
  const formattedDate = formatEventDate(event.dateStart, event.dateEnd);

  return (
    <Pressable
      onPress={onPress}
      className={cn(
        'rounded-2xl border border-[rgba(141,141,141,0.4)] bg-[rgba(141,141,141,0.1)] overflow-hidden active:opacity-90',
        className
      )}
    >
      {/* Cover image — real photos arrive in M10 (docs/project-management/M10-Media/M10-T1-Media-Upload-S3-Mux.md) */}
      <View className="h-[208px] relative">
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

        {/* Top-left category badge */}
        <View className="absolute top-3 left-3 bg-[#080808] rounded-xl px-2 py-1.5">
          <Text className="text-[12px] text-[#C8FF2F] font-semibold tracking-wide uppercase">
            {categoryLabel}
          </Text>
        </View>

        {/* Bottom overlay: category pill + joined count */}
        <View className="absolute bottom-3 left-3 right-3 flex-row items-center justify-between">
          <View className="flex-row items-center bg-[#C8FF2F] rounded-full px-2 h-4 gap-0.5">
            <Text className="text-[11px]">{categoryIcon}</Text>
            <Text className="text-[11px] font-semibold text-black font-urbanist">
              {categoryLabel}
            </Text>
          </View>

          {event.joinedCount > 0 && (
            <View className="flex-row items-center bg-white rounded-full px-2 h-4 gap-0.5">
              <Ionicons name="people-outline" size={10} color="#000" />
              <Text className="text-[10px] font-semibold text-black font-urbanist">
                {event.joinedCount} Joined
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Content area */}
      <View className="px-3 pt-3 pb-4">
        <Text className="text-2xl font-semibold text-white font-urbanist" numberOfLines={2}>
          {event.title}
        </Text>

        <View className="flex-row items-start gap-2 mt-2">
          {/* Venue */}
          <View className="flex-1 flex-row items-center gap-1">
            <Ionicons name="location-outline" size={12} color="rgba(255,255,255,0.6)" />
            <Text className="text-xs font-semibold text-white/60 font-urbanist" numberOfLines={1}>
              {event.venueAddress ?? 'Location TBC'}
            </Text>
          </View>

          {/* Date */}
          <View className="flex-row items-center gap-1">
            <Ionicons name="calendar-outline" size={12} color="rgba(255,255,255,0.6)" />
            <Text className="text-xs font-semibold text-white/60 font-urbanist" numberOfLines={1}>
              {formattedDate}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function formatEventDate(dateStart: string, dateEnd?: string): string {
  const start = new Date(dateStart);
  const month = start.toLocaleString('en-IE', { month: 'short' });
  const day = start.getDate();
  const time = start.toLocaleString('en-IE', { hour: 'numeric', minute: '2-digit', hour12: true });

  if (dateEnd) {
    const end = new Date(dateEnd);
    const endTime = end.toLocaleString('en-IE', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    return `${month} ${day}, ${time}-${endTime}`;
  }

  return `${month} ${day}, ${time}`;
}
