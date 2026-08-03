import { Ionicons } from '@expo/vector-icons';
import { cn } from 'heroui-native';
import type { ReactNode } from 'react';
import { Image, Pressable, Text, View } from 'react-native';

import { CategoryChip } from '@/components/CategoryChip';
import { clampFeedRatio, FALLBACK_RATIO, useImageRatio } from '@/hooks/use-image-ratio';
import { formatEventDate } from '@/utils/format-event-date';

interface BaseEventCardProps {
  title: string;
  coverImageUrl: string | null;
  dateStart: string;
  dateEnd?: string;
  category: string;
  venueAddress: string | null;
  onPress: () => void;
  className?: string;
  /** Badge rendered at top-left of the cover image (e.g. collection name, category label) */
  topLeftBadge?: ReactNode;
  /** Badge rendered at top-right of the cover image (e.g. status indicator) */
  topRightBadge?: ReactNode;
  /** Element rendered at bottom-right of the cover overlay (e.g. joined count) */
  bottomRightOverlay?: ReactNode;
  /** Content rendered below the info area but inside the card border (e.g. cancel button) */
  bottomSlot?: ReactNode;
  /** Small line under the location/date row (e.g. "by {creatorName}") */
  byline?: string;
}

export function BaseEventCard({
  title,
  coverImageUrl,
  dateStart,
  dateEnd,
  category,
  venueAddress,
  onPress,
  className,
  topLeftBadge,
  topRightBadge,
  bottomRightOverlay,
  bottomSlot,
  byline,
}: BaseEventCardProps) {
  const formattedDate = formatEventDate(dateStart, dateEnd);

  // Cover art is usually a gig poster, so the card takes the poster's own shape
  // — same treatment as the Posts feed, so the two Discover tabs behave alike.
  const natural = useImageRatio(coverImageUrl);
  const coverRatio = natural === null ? FALLBACK_RATIO : clampFeedRatio(natural);

  return (
    <Pressable
      onPress={onPress}
      className={cn(
        'rounded-2xl border border-[rgba(141,141,141,0.4)] bg-[rgba(141,141,141,0.1)] overflow-hidden active:opacity-90',
        className
      )}
    >
      {/* Cover image — shown whole at the poster's own ratio. With no cover
          there is nothing to show, so the placeholder stays short rather than
          reserving a screenful of empty grey. */}
      <View
        style={coverImageUrl ? { aspectRatio: coverRatio } : undefined}
        className={cn('relative', !coverImageUrl && 'h-[140px]')}
      >
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

        {/* Top-left badge slot */}
        {topLeftBadge && <View className="absolute top-3 left-3">{topLeftBadge}</View>}

        {/* Top-right badge slot */}
        {topRightBadge && <View className="absolute top-3 right-3">{topRightBadge}</View>}

        {/* Bottom overlay: category pill + optional right element */}
        <View className="absolute bottom-3 left-3 right-3 flex-row items-center justify-between">
          <CategoryChip category={category} />
          {bottomRightOverlay}
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

        {byline && (
          <Text className="text-xs text-white/40 font-urbanist mt-2" numberOfLines={1}>
            {byline}
          </Text>
        )}
      </View>

      {/* Optional bottom slot (e.g. cancel button) */}
      {bottomSlot}
    </Pressable>
  );
}
