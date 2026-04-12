import { Ionicons } from '@expo/vector-icons';
import { cn } from 'heroui-native';
import { Image, Pressable, Text, View } from 'react-native';

import { CATEGORY_ICONS, CATEGORY_LABELS } from '@CeolX/shared';

interface ProfileEventCardProps {
  id: string;
  title: string;
  coverImage: string | null;
  dateStart: string;
  dateEnd?: string | null;
  category: string;
  venueAddress: string | null;
  status?: string;
  onPress: () => void;
  className?: string;
}

export function ProfileEventCard({
  title,
  coverImage,
  dateStart,
  dateEnd,
  category,
  venueAddress,
  status,
  onPress,
  className,
}: ProfileEventCardProps) {
  const categoryLabel = CATEGORY_LABELS[category] ?? category;
  const categoryIcon = CATEGORY_ICONS[category] ?? '🎵';
  const formattedDate = formatEventDate(dateStart, dateEnd ?? undefined);

  return (
    <Pressable
      onPress={onPress}
      className={cn(
        'rounded-2xl border border-[rgba(141,141,141,0.4)] bg-[rgba(141,141,141,0.1)] overflow-hidden active:opacity-90',
        className
      )}
    >
      {/* Cover image */}
      <View className="h-[208px] relative">
        {coverImage ? (
          <Image
            source={{ uri: coverImage }}
            className="absolute inset-0 w-full h-full"
            resizeMode="cover"
          />
        ) : (
          <View className="absolute inset-0 w-full h-full bg-white/5 items-center justify-center">
            <Text className="text-4xl">🎵</Text>
          </View>
        )}

        {/* Category badge top-left */}
        <View className="absolute top-3 left-3 bg-[#080808] rounded-xl px-2 py-1.5">
          <Text className="text-[12px] text-[#C8FF2F] font-semibold tracking-wide uppercase">
            {categoryLabel}
          </Text>
        </View>

        {/* Status badge top-right for non-active events */}
        {status && status !== 'active' && (
          <View
            className={cn(
              'absolute top-3 right-3 rounded-lg px-2 py-1',
              status === 'archived' && 'bg-[rgba(141,141,141,0.8)]',
              status === 'removed' && 'bg-red-600',
              status === 'draft' && 'bg-[#6155F5]'
            )}
          >
            <Text className="text-[10px] font-semibold text-white font-urbanist capitalize">
              {status}
            </Text>
          </View>
        )}

        {/* Bottom overlay: category pill */}
        <View className="absolute bottom-3 left-3 right-3 flex-row items-center">
          <View className="flex-row items-center bg-[#C8FF2F] rounded-full px-2 h-4 gap-0.5">
            <Text className="text-[11px]">{categoryIcon}</Text>
            <Text className="text-[11px] font-semibold text-black font-urbanist">
              {categoryLabel}
            </Text>
          </View>
        </View>
      </View>

      {/* Content area */}
      <View className="px-3 pt-3 pb-4">
        <Text className="text-2xl font-semibold text-white font-urbanist" numberOfLines={2}>
          {title}
        </Text>

        <View className="flex-row items-start gap-2 mt-2">
          <View className="flex-1 flex-row items-center gap-1">
            <Ionicons name="location-outline" size={12} color="rgba(255,255,255,0.6)" />
            <Text className="text-xs font-semibold text-white/60 font-urbanist" numberOfLines={1}>
              {venueAddress ?? 'Location TBC'}
            </Text>
          </View>

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
