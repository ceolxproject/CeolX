import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import type { BookingSummary } from '@CeolX/shared';

interface RequestActionsProps {
  booking: BookingSummary;
  userRole: 'artist' | 'venue';
  onAccept?: () => void;
  onReject?: () => void;
  onWithdraw?: () => void;
  onCancel?: () => void;
  isUpdating?: boolean;
}

export function RequestActions({
  booking,
  userRole,
  onAccept,
  onReject,
  onWithdraw,
  onCancel: _onCancel,
  isUpdating,
}: RequestActionsProps) {
  if (booking.status !== 'pending') return null;

  const isSentByUser =
    (userRole === 'venue' && booking.direction === 'venue_to_artist') ||
    (userRole === 'artist' && booking.direction === 'artist_to_venue');

  if (isUpdating) {
    return (
      <View className="flex-row items-center justify-center mt-3 py-3">
        <ActivityIndicator size="small" color="#C8FF2F" />
      </View>
    );
  }

  if (isSentByUser) {
    // Venue sent → can RESEND (no-op placeholder) or WITHDRAW
    return (
      <View className="flex-row gap-3 mt-3">
        <Pressable
          className="flex-1 items-center py-2.5 rounded-full border border-[#C8FF2F] active:opacity-70"
          accessibilityRole="button"
          accessibilityLabel="Resend request"
        >
          <Text className="text-sm font-bold text-[#C8FF2F] font-urbanist">RESEND</Text>
        </Pressable>
        <Pressable
          onPress={onWithdraw}
          className="flex-1 items-center py-2.5 rounded-full border border-white/30 active:opacity-70"
          accessibilityRole="button"
          accessibilityLabel="Withdraw request"
        >
          <Text className="text-sm font-bold text-white font-urbanist">WITHDRAW</Text>
        </Pressable>
      </View>
    );
  }

  // Artist received → can ACCEPT or REJECT
  return (
    <View className="flex-row gap-3 mt-3">
      <Pressable
        onPress={onAccept}
        className="flex-1 items-center py-2.5 rounded-full bg-[#662FFF] active:opacity-70"
        accessibilityRole="button"
        accessibilityLabel="Accept request"
      >
        <Text className="text-sm font-bold text-white font-urbanist tracking-wider">ACCEPT</Text>
      </Pressable>
      <Pressable
        onPress={onReject}
        className="flex-1 items-center py-2.5 rounded-full border border-[#8D8D8D] active:opacity-70"
        accessibilityRole="button"
        accessibilityLabel="Reject request"
      >
        <Text className="text-sm font-bold text-white font-urbanist tracking-wider">REJECT</Text>
      </Pressable>
    </View>
  );
}
