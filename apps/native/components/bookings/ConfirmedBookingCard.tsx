import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';

import { CATEGORY_LABELS } from '@CeolX/shared';

import { BaseEventCard } from '@/components/BaseEventCard';

interface ConfirmedBookingCardProps {
  title: string;
  coverImage: string | null;
  dateStart: string;
  dateEnd?: string | null;
  category: string;
  venueAddress: string | null;
  bookingId: string | null;
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
  onCancel,
  onPress,
  className,
}: ConfirmedBookingCardProps) {
  const [isCancelling, setIsCancelling] = useState(false);
  const categoryLabel = CATEGORY_LABELS[category] ?? category;

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
    <View className={className}>
      <BaseEventCard
        title={title}
        coverImageUrl={coverImage}
        dateStart={dateStart}
        dateEnd={dateEnd ?? undefined}
        category={category}
        venueAddress={venueAddress}
        onPress={onPress}
        topLeftBadge={
          <View className="bg-[#080808] rounded-xl px-2 py-1.5">
            <Text className="text-[12px] text-[#C8FF2F] font-semibold tracking-wide uppercase">
              {categoryLabel}
            </Text>
          </View>
        }
      />
      {bookingId && (
        <Pressable
          className="mt-2 border border-red-500/40 rounded-xl py-2.5 items-center active:opacity-70"
          onPress={handleCancel}
          disabled={isCancelling}
        >
          {isCancelling ? (
            <ActivityIndicator size="small" color="#ef4444" />
          ) : (
            <Text className="text-sm font-semibold text-red-500 font-urbanist">Cancel Booking</Text>
          )}
        </Pressable>
      )}
    </View>
  );
}
