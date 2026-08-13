import { Ionicons } from '@expo/vector-icons';
import { cn } from 'heroui-native';
import { Text, View } from 'react-native';

import { EventStatus } from '@CeolX/shared/enums';

import { BaseEventCard } from './BaseEventCard';
import { EventCardOwnerMenu, type EventCardOwnerActions } from './EventCardOwnerMenu';
import { EventCollectionBadge } from './EventCollectionBadge';

interface ProfileEventCardProps {
  id: string;
  title: string;
  coverImage: string | null;
  dateStart: string;
  dateEnd?: string | null;
  category: string;
  venueAddress: string | null;
  /** Name of the collection this event belongs to — shown as the top-left tag. */
  collectionName?: string | null;
  status?: string;
  joinedCount?: number;
  ownerActions?: EventCardOwnerActions;
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
  collectionName,
  status,
  joinedCount,
  ownerActions,
  onPress,
  className,
}: ProfileEventCardProps) {
  const showJoinedBadge = typeof joinedCount === 'number' && joinedCount > 0;

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
      topLeftBadge={collectionName ? <EventCollectionBadge name={collectionName} /> : undefined}
      topRightBadge={
        ownerActions ? (
          <EventCardOwnerMenu actions={ownerActions} canDelete={status === EventStatus.ACTIVE} />
        ) : status && status !== EventStatus.ACTIVE ? (
          <View
            className={cn(
              'rounded-lg px-2 py-1',
              status === EventStatus.ARCHIVED && 'bg-[rgba(141,141,141,0.8)]',
              status === EventStatus.REMOVED && 'bg-red-600',
              status === EventStatus.DRAFT && 'bg-[#6155F5]',
              // Artist event awaiting the tagged venue's approval before going live.
              status === EventStatus.PENDING_REVIEW && 'bg-[#b8860b]'
            )}
          >
            <Text className="text-[10px] font-semibold text-white font-urbanist capitalize">
              {status === EventStatus.PENDING_REVIEW ? 'Awaiting approval' : status}
            </Text>
          </View>
        ) : undefined
      }
      bottomRightOverlay={
        showJoinedBadge ? (
          <View className="flex-row items-center gap-1 rounded-full bg-black/55 px-2.5 py-1">
            <Ionicons name="person-outline" size={11} color="white" />
            <Text className="text-[11px] font-semibold text-white font-urbanist">
              {joinedCount} Joined
            </Text>
          </View>
        ) : undefined
      }
    />
  );
}
