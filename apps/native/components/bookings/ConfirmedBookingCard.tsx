import { Ionicons } from '@expo/vector-icons';
import { cn } from 'heroui-native';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';

import { CATEGORY_LABELS, isEventUnavailableForCollaboration } from '@CeolX/shared';
import type { EventStatus } from '@CeolX/shared/enums';

import { BaseEventCard } from '@/components/BaseEventCard';

interface ConfirmedBookingCardProps {
  title: string;
  coverImage: string | null;
  dateStart: string;
  dateEnd?: string | null;
  category: string;
  venueAddress: string | null;
  bookingId: string | null;
  /** Current status of the linked event — drives the deleted tombstone state. */
  eventStatus: EventStatus;
  onCancel: (bookingId: string) => Promise<void>;
  onPress: () => void;
  className?: string;
}

export function ConfirmedBookingCard({
  title,
  coverImage,
  dateStart,
  dateEnd,
  category,
  venueAddress,
  bookingId,
  eventStatus,
  onCancel,
  onPress,
  className,
}: ConfirmedBookingCardProps) {
  const [isCancelling, setIsCancelling] = useState(false);
  const categoryLabel = CATEGORY_LABELS[category] ?? category;

  // Event deleted/removed → read-only tombstone: no navigation, no cancel
  // action (the server rejects it anyway). (Asana 1215700058852004)
  const isEventDeleted = isEventUnavailableForCollaboration(eventStatus);

  const handleCancel = () => {
    if (!bookingId) return;

    Alert.alert(
      'Cancel Booking?',
      `You will be removed as a participant from "${title}". This cannot be undone.`,
      [
        { text: 'Keep Booking', style: 'cancel' },
        {
          text: 'Cancel Booking',
          style: 'destructive',
          onPress: () => {
            setIsCancelling(true);
            void onCancel(bookingId).finally(() => setIsCancelling(false));
          },
        },
      ]
    );
  };

  return (
    <BaseEventCard
      title={title}
      coverImageUrl={coverImage}
      dateStart={dateStart}
      dateEnd={dateEnd ?? undefined}
      category={category}
      venueAddress={venueAddress}
      onPress={isEventDeleted ? () => {} : onPress}
      className={cn(isEventDeleted && 'opacity-60', className)}
      topLeftBadge={
        <View className="bg-[#080808] rounded-xl px-2 py-1.5">
          <Text className="text-[12px] text-[#C8FF2F] font-semibold tracking-wide uppercase">
            {categoryLabel}
          </Text>
        </View>
      }
      topRightBadge={
        isEventDeleted ? (
          <View className="flex-row items-center gap-1 bg-[#3A3A3A] rounded-xl px-2 py-1.5">
            <Ionicons name="alert-circle-outline" size={13} color="#FFFFFF" />
            <Text className="text-[12px] text-white font-bold tracking-wide uppercase">
              Unavailable
            </Text>
          </View>
        ) : (
          <View className="flex-row items-center gap-1 bg-[#C8FF2F] rounded-xl px-2 py-1.5">
            <Ionicons name="checkmark-circle" size={13} color="#080808" />
            <Text className="text-[12px] text-[#080808] font-bold tracking-wide uppercase">
              Confirmed
            </Text>
          </View>
        )
      }
      bottomSlot={
        isEventDeleted ? (
          <View className="mx-3 mb-3 flex-row items-center gap-1.5">
            <Ionicons name="alert-circle-outline" size={14} color="rgba(255,255,255,0.6)" />
            <Text className="text-xs text-white/60 font-urbanist flex-1">
              This event is no longer available — it was deleted by the venue.
            </Text>
          </View>
        ) : bookingId ? (
          <Pressable
            className="mx-3 mb-3 border border-red-500/40 rounded-xl py-2.5 items-center active:opacity-70"
            onPress={handleCancel}
            disabled={isCancelling}
          >
            {isCancelling ? (
              <ActivityIndicator size="small" color="#ef4444" />
            ) : (
              <Text className="text-sm font-semibold text-red-500 font-urbanist">
                Cancel Booking
              </Text>
            )}
          </Pressable>
        ) : undefined
      }
    />
  );
}
