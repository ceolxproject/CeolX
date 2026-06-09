import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CATEGORY_LABELS } from '@CeolX/shared';
import { BookingDirection, BookingStatus, UserRole } from '@CeolX/shared/enums';

import { appToast } from '@/components/AppToast';
import { RequestActions } from '@/components/requests/RequestActions';
import { useUpdateBooking } from '@/hooks/use-update-booking';
import { authClient } from '@/lib/auth-client';
import { formatEventDate } from '@/utils/format-event-date';
import { trpc } from '@/utils/trpc';

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: 'bg-yellow-900/30', text: 'text-yellow-400', label: 'Pending' },
  accepted: { bg: 'bg-green-900/30', text: 'text-green-400', label: 'Accepted' },
  rejected: { bg: 'bg-red-900/30', text: 'text-red-400', label: 'Declined' },
  cancelled: { bg: 'bg-gray-800/30', text: 'text-gray-400', label: 'Cancelled' },
};

export default function BookingDetailScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const { data: session } = authClient.useSession();
  const userRole = (session?.user?.currentRole ?? 'spectator') as 'artist' | 'venue';

  const { data: booking, isLoading } = useQuery(trpc.bookings.byId.queryOptions({ id: bookingId }));

  const updateBooking = useUpdateBooking();
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdate = useCallback(
    async (status: 'accepted' | 'rejected' | 'cancelled') => {
      if (!bookingId) return;
      setIsUpdating(true);
      try {
        await updateBooking.mutateAsync({ id: bookingId, status });
        if (status === BookingStatus.CANCELLED) appToast.success('Request withdrawn');
      } catch (err) {
        if (status === BookingStatus.CANCELLED) {
          appToast.error(
            'Could not withdraw request',
            err instanceof Error ? err.message : 'Please try again.'
          );
        } else {
          throw err;
        }
      } finally {
        setIsUpdating(false);
      }
    },
    [bookingId, updateBooking]
  );

  if (isLoading || !booking) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#080808' }} edges={['top']}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#C8FF2F" />
        </View>
      </SafeAreaView>
    );
  }

  const categoryLabel = CATEGORY_LABELS[booking.eventCategory] ?? booking.eventCategory;
  const formattedDate = formatEventDate(booking.eventDateStart, booking.eventDateEnd);
  const statusStyle = STATUS_STYLES[booking.status] ?? STATUS_STYLES.pending;

  // Whether the viewer is the one who sent this request — drives the direction
  // label only.
  const isSentByUser =
    (userRole === UserRole.VENUE && booking.direction === BookingDirection.VENUE_TO_ARTIST) ||
    (userRole === UserRole.ARTIST && booking.direction === BookingDirection.ARTIST_TO_VENUE);

  // "Other party" is always the party that is NOT you, regardless of who sent
  // the request — a venue always sees the artist, an artist always the venue.
  const otherPartyName = userRole === UserRole.VENUE ? booking.artistName : booking.venueName;
  const otherPartyImage = userRole === UserRole.VENUE ? booking.artistImage : booking.venueImage;
  const directionLabel = isSentByUser ? 'Sent Request to:' : 'Request Sent by:';
  const contactLabel = userRole === UserRole.ARTIST ? 'CONTACT VENUE' : 'CONTACT ARTIST';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#080808' }} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Cover image */}
        <View className="h-[220px] relative">
          {booking.eventCoverImage ? (
            <Image
              source={{ uri: booking.eventCoverImage }}
              className="absolute inset-0 w-full h-full"
              resizeMode="cover"
            />
          ) : (
            <View className="absolute inset-0 w-full h-full bg-white/5 items-center justify-center">
              <Text className="text-5xl">🎵</Text>
            </View>
          )}

          {/* Category badge */}
          <View className="absolute top-3 left-3 bg-[#080808] rounded-xl px-2 py-1.5">
            <Text className="text-[12px] text-[#C8FF2F] font-semibold tracking-wide uppercase">
              {categoryLabel}
            </Text>
          </View>

          {/* Status badge */}
          <View className={`absolute top-3 right-3 ${statusStyle.bg} rounded-full px-3 py-1`}>
            <Text className={`text-[11px] font-semibold ${statusStyle.text}`}>
              {statusStyle.label}
            </Text>
          </View>
        </View>

        {/* Content */}
        <View className="px-5 pt-4 pb-8">
          {/* Event title */}
          <Text className="text-2xl font-semibold text-white font-urbanist">
            {booking.eventTitle}
          </Text>

          {/* Location + date */}
          <View className="flex-row items-start gap-4 mt-3">
            <View className="flex-1 flex-row items-center gap-1">
              <Ionicons name="location-outline" size={14} color="rgba(255,255,255,0.6)" />
              <Text className="text-xs font-semibold text-white/60 font-urbanist" numberOfLines={1}>
                {booking.eventVenueAddress ?? 'Location TBC'}
              </Text>
            </View>
            <View className="flex-row items-center gap-1">
              <Ionicons name="calendar-outline" size={14} color="rgba(255,255,255,0.6)" />
              <Text className="text-xs font-semibold text-white/60 font-urbanist" numberOfLines={1}>
                {formattedDate}
              </Text>
            </View>
          </View>

          {/* Divider */}
          <View className="h-px bg-white/10 my-4" />

          {/* Direction label + other party */}
          <Text className="text-xs text-white/50 font-urbanist mb-2">{directionLabel}</Text>
          <View className="flex-row items-center gap-3">
            {otherPartyImage ? (
              <Image source={{ uri: otherPartyImage }} className="w-10 h-10 rounded-full" />
            ) : (
              <View className="w-10 h-10 rounded-full bg-white/10 items-center justify-center">
                <Ionicons name="person" size={20} color="rgba(255,255,255,0.4)" />
              </View>
            )}
            <Text className="text-base font-bold text-white font-urbanist flex-1">
              {otherPartyName}
            </Text>
            {booking.status === BookingStatus.ACCEPTED && (
              <Pressable
                onPress={() =>
                  router.push(
                    userRole === UserRole.ARTIST
                      ? `/(app)/venue/${booking.venueUserId}`
                      : `/(app)/artist/${booking.artistUserId}`
                  )
                }
                hitSlop={8}
              >
                <Text className="text-xs font-bold text-[#D4FC5A] font-urbanist tracking-wide">
                  {contactLabel}
                </Text>
              </Pressable>
            )}
          </View>

          {/* Accepted confirmation */}
          {booking.status === BookingStatus.ACCEPTED && (
            <View className="flex-row items-center gap-2 mt-4 bg-green-900/10 rounded-xl px-3 py-2.5">
              <Ionicons name="checkmark-circle" size={18} color="#4ADE80" />
              <Text className="text-xs text-white/80 font-urbanist">
                Request Accepted on {formatAcceptedDate(booking.updatedAt)}
              </Text>
            </View>
          )}

          {/* Rejected / Cancelled info */}
          {booking.status === BookingStatus.REJECTED && (
            <View className="flex-row items-center gap-2 mt-4 bg-red-900/10 rounded-xl px-3 py-2.5">
              <Ionicons name="close-circle" size={18} color="#F87171" />
              <Text className="text-xs text-white/80 font-urbanist">
                Request Rejected on {formatAcceptedDate(booking.updatedAt)}
              </Text>
            </View>
          )}

          {booking.status === BookingStatus.CANCELLED && (
            <View className="flex-row items-center gap-2 mt-4 bg-gray-800/20 rounded-xl px-3 py-2.5">
              <Ionicons name="ban" size={18} color="#9CA3AF" />
              <Text className="text-xs text-white/80 font-urbanist">
                Cancelled{booking.cancelledByName ? ` by ${booking.cancelledByName}` : ''} on{' '}
                {formatAcceptedDate(booking.updatedAt)}
              </Text>
            </View>
          )}

          {/* Action buttons for pending */}
          {booking.status === BookingStatus.PENDING && (
            <RequestActions
              booking={booking}
              userRole={userRole}
              onAccept={() => handleUpdate(BookingStatus.ACCEPTED)}
              onReject={() => handleUpdate(BookingStatus.REJECTED)}
              onWithdraw={() => handleUpdate(BookingStatus.CANCELLED)}
              onCancel={() => handleUpdate(BookingStatus.CANCELLED)}
              isUpdating={isUpdating}
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function formatAcceptedDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('en-IE', { month: 'short', day: 'numeric', year: 'numeric' });
}
