import { cn } from 'heroui-native';
import { Text, View } from 'react-native';

import { CATEGORY_LABELS } from '@CeolX/shared';
import { EventStatus } from '@CeolX/shared/enums';

import { BaseEventCard } from './BaseEventCard';

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

  return (
    <BaseEventCard
      title={title}
      coverImageUrl={coverImage}
      dateStart={dateStart}
      dateEnd={dateEnd ?? undefined}
      category={category}
      venueAddress={venueAddress}
      onPress={onPress}
      className={className}
      topLeftBadge={
        <View className="bg-[#080808] rounded-xl px-2 py-1.5">
          <Text className="text-[12px] text-[#C8FF2F] font-semibold tracking-wide uppercase">
            {categoryLabel}
          </Text>
        </View>
      }
      topRightBadge={
        status && status !== EventStatus.ACTIVE ? (
          <View
            className={cn(
              'rounded-lg px-2 py-1',
              status === EventStatus.ARCHIVED && 'bg-[rgba(141,141,141,0.8)]',
              status === EventStatus.REMOVED && 'bg-red-600',
              status === EventStatus.DRAFT && 'bg-[#6155F5]'
            )}
          >
            <Text className="text-[10px] font-semibold text-white font-urbanist capitalize">
              {status}
            </Text>
          </View>
        ) : undefined
      }
    />
  );
}
