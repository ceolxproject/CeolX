import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { cn } from 'heroui-native';
import { Image, Pressable, Text, View } from 'react-native';

import type { BookingSummary } from '@CeolX/shared';
import { CATEGORY_LABELS } from '@CeolX/shared';
import { BookingDirection, BookingStatus, UserRole } from '@CeolX/shared/enums';

import { RequestActions } from './RequestActions';

import { formatEventDate } from '@/utils/format-event-date';
import { getMockEventImage, MOCK_PROFILE_IMAGE } from '@/utils/mock-images';

interface RequestCardProps {
  booking: BookingSummary;
  userRole: 'artist' | 'venue';
  onAccept?: () => void;
  onReject?: () => void;
  onWithdraw?: () => void;
  onCancel?: () => void;
  isUpdating?: boolean;
  className?: string;
}

export function RequestCard({
  booking,
  userRole,
  onAccept,
  onReject,
  onWithdraw,
  onCancel,
  isUpdating,
  className,
}: RequestCardProps) {
  const categoryLabel = CATEGORY_LABELS[booking.eventCategory] ?? booking.eventCategory;
  const formattedDate = formatEventDate(booking.eventDateStart, booking.eventDateEnd);
  const timeSince = getTimeSince(booking.createdAt);

  const isA2A = booking.direction === BookingDirection.ARTIST_TO_ARTIST;

  // For artist↔artist the server tells us whether the viewer is the inviter
  // (sender) via viewerIsSender, since both parties are artists.
  const isSentByUser = isA2A
    ? booking.viewerIsSender === true
    : (userRole === UserRole.VENUE && booking.direction === BookingDirection.VENUE_TO_ARTIST) ||
      (userRole === UserRole.ARTIST && booking.direction === BookingDirection.ARTIST_TO_VENUE);

  // "Other party" is always whoever is NOT the viewer.
  const otherPartyName = isA2A
    ? isSentByUser
      ? booking.artistName // viewer is the inviter → other party is the invited co-artist
      : (booking.inviterArtistName ?? 'Artist')
    : userRole === UserRole.VENUE
      ? booking.artistName
      : booking.venueName;
  const otherPartyImage = isA2A
    ? isSentByUser
      ? booking.artistImage
      : booking.inviterArtistImage
    : userRole === UserRole.VENUE
      ? booking.artistImage
      : booking.venueImage;
  const directionLabel = isSentByUser ? 'Sent Request to:' : 'Request Sent by:';

  const isAccepted = booking.status === BookingStatus.ACCEPTED;

  return (
    <Pressable
      onPress={() => router.push(`/(app)/(tabs)/bookings/${booking.id}`)}
      className={cn(
        'rounded-2xl border border-[rgba(141,141,141,0.4)] bg-[rgba(141,141,141,0.1)] overflow-hidden active:opacity-90',
        className
      )}
    >
      {/* Cover image */}
      <View className="h-[180px] relative">
        <Image
          source={
            booking.eventCoverImage
              ? { uri: booking.eventCoverImage }
              : getMockEventImage(booking.id)
          }
          className="absolute inset-0 w-full h-full"
          resizeMode="cover"
        />

        {/* Top-left category badge */}
        <View className="absolute top-3 left-3 bg-[#080808] rounded-xl px-2 py-1.5">
          <Text className="text-[12px] text-[#C8FF2F] font-semibold tracking-wide uppercase">
            {categoryLabel}
          </Text>
        </View>

        {/* Bottom-left time-since pill */}
        <View className="absolute bottom-3 left-3 bg-white rounded-[15px] px-2 py-1">
          <Text className="text-[10px] font-semibold text-black font-urbanist">{timeSince}</Text>
        </View>
      </View>

      {/* Content area */}
      <View className="px-3 pt-3 pb-4">
        {/* Event title */}
        <Text className="text-xl font-semibold text-white font-urbanist" numberOfLines={2}>
          {booking.eventTitle}
        </Text>

        {/* Location + date row */}
        <View className="flex-row items-start gap-4 mt-2">
          <View className="flex-1 flex-row items-center gap-1">
            <Ionicons name="location-outline" size={12} color="rgba(255,255,255,0.6)" />
            <Text className="text-xs font-semibold text-white/60 font-urbanist" numberOfLines={1}>
              {booking.eventVenueAddress ?? 'Location TBC'}
            </Text>
          </View>
          <View className="flex-row items-center gap-1">
            <Ionicons name="calendar-outline" size={12} color="rgba(255,255,255,0.6)" />
            <Text className="text-xs font-semibold text-white/60 font-urbanist" numberOfLines={1}>
              {formattedDate}
            </Text>
          </View>
        </View>

        {/* Direction label + other party */}
        <View className="mt-3">
          <Text className="text-xs text-white/50 font-urbanist mb-1.5">{directionLabel}</Text>
          <View className="flex-row items-center gap-2">
            <Image
              source={otherPartyImage ? { uri: otherPartyImage } : MOCK_PROFILE_IMAGE}
              className="w-8 h-8 rounded-full"
            />
            <Text className="text-sm font-semibold text-white font-urbanist flex-1">
              {otherPartyName}
            </Text>
            {isAccepted && (
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
                  {userRole === UserRole.ARTIST && !isA2A ? 'CONTACT VENUE' : 'CONTACT ARTIST'}
                </Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Accepted confirmation or action buttons */}
        {isAccepted ? (
          <View className="flex-row items-center gap-1.5 mt-3">
            <Ionicons name="checkmark-circle" size={16} color="#C8FF2F" />
            <Text className="text-xs text-white/60 font-urbanist">
              Request Accepted on {formatAcceptedDate(booking.updatedAt)}
            </Text>
          </View>
        ) : (
          <RequestActions
            booking={booking}
            userRole={userRole}
            onAccept={onAccept}
            onReject={onReject}
            onWithdraw={onWithdraw}
            onCancel={onCancel}
            isUpdating={isUpdating}
          />
        )}
      </View>
    </Pressable>
  );
}

function getTimeSince(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
  }
  const months = Math.floor(diffDays / 30);
  return months === 1 ? '1 month ago' : `${months} months ago`;
}

function formatAcceptedDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('en-IE', { month: 'short', day: 'numeric', year: 'numeric' });
}
