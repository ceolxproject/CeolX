import { cn } from 'heroui-native';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';

import {
  isEventPast,
  isEventUnavailableForCollaboration,
  RESEND_COOLDOWN_MS,
  type BookingSummary,
} from '@CeolX/shared';
import { BookingDirection, BookingStatus, UserRole } from '@CeolX/shared/enums';

/** A pending-request action that can be in flight (drives per-button feedback). */
export type RequestAction = 'accept' | 'reject' | 'withdraw' | 'resend';

/** Maps a booking status transition to its button action + toast copy. Shared by
 *  the Requests tab and the booking detail screen so feedback stays consistent. */
export const BOOKING_STATUS_FEEDBACK: Record<
  'accepted' | 'rejected' | 'cancelled',
  { action: RequestAction; success: string; error: string }
> = {
  accepted: { action: 'accept', success: 'Request accepted', error: 'Could not accept request' },
  rejected: { action: 'reject', success: 'Request declined', error: 'Could not decline request' },
  cancelled: {
    action: 'withdraw',
    success: 'Request withdrawn',
    error: 'Could not withdraw request',
  },
};

interface RequestActionsProps {
  booking: BookingSummary;
  userRole: 'artist' | 'venue';
  onAccept?: () => void;
  onReject?: () => void;
  onWithdraw?: () => void;
  onResend?: () => void;
  onCancel?: () => void;
  /** Which action is currently in flight — shows a spinner on that button and
   *  disables the rest. Null = idle. */
  pendingAction?: RequestAction | null;
}

export function RequestActions({
  booking,
  userRole,
  onAccept,
  onReject,
  onWithdraw,
  onResend,
  onCancel: _onCancel,
  pendingAction,
}: RequestActionsProps) {
  if (booking.status !== BookingStatus.PENDING) return null;

  // Event deleted/removed → no actions are valid (the server rejects them too).
  // The card/detail screen shows the "no longer available" notice instead.
  if (isEventUnavailableForCollaboration(booking.eventStatus)) return null;

  const isSentByUser =
    booking.direction === BookingDirection.ARTIST_TO_ARTIST
      ? booking.viewerIsSender === true
      : (userRole === UserRole.VENUE && booking.direction === BookingDirection.VENUE_TO_ARTIST) ||
        (userRole === UserRole.ARTIST && booking.direction === BookingDirection.ARTIST_TO_VENUE);

  const isBusy = Boolean(pendingAction);

  if (isSentByUser) {
    // Anti-spam: a pending row's updatedAt is its last-sent time, so block (and
    // visibly disable) RESEND inside the cooldown window. The backend enforces
    // this too — the disabled state just avoids a guaranteed-to-fail tap.
    // (Asana 1215700058851990, bug #2)
    const msSinceLastSent = Date.now() - new Date(booking.updatedAt).getTime();
    const isWithinResendCooldown = msSinceLastSent < RESEND_COOLDOWN_MS;
    const resendDisabled = isBusy || isWithinResendCooldown;

    // Confirm before the destructive withdraw so an accidental tap can't silently
    // cancel a live request. (Asana 1215700058851990, bug #3)
    const confirmWithdraw = () => {
      if (!onWithdraw) return;
      Alert.alert(
        'Withdraw request?',
        'This cancels your request to the other party. You can send a new one later.',
        [
          { text: 'Keep request', style: 'cancel' },
          { text: 'Withdraw', style: 'destructive', onPress: onWithdraw },
        ]
      );
    };

    // Sender → can RESEND the invite or WITHDRAW it.
    return (
      <View className="mt-3">
        <View className="flex-row gap-3">
          <Pressable
            onPress={onResend}
            disabled={resendDisabled}
            className={cn(
              'flex-1 items-center py-2.5 rounded-full border border-[#C8FF2F] active:opacity-70',
              resendDisabled && 'opacity-50'
            )}
            accessibilityRole="button"
            accessibilityState={{ disabled: resendDisabled, busy: pendingAction === 'resend' }}
            accessibilityLabel="Resend request"
          >
            {pendingAction === 'resend' ? (
              <ActivityIndicator size="small" color="#C8FF2F" />
            ) : (
              <Text className="text-sm font-bold text-[#C8FF2F] font-urbanist">
                {isWithinResendCooldown ? 'RECENTLY SENT' : 'RESEND'}
              </Text>
            )}
          </Pressable>
          <Pressable
            onPress={confirmWithdraw}
            disabled={isBusy}
            className={cn(
              'flex-1 items-center py-2.5 rounded-full border border-white/30 active:opacity-70',
              isBusy && 'opacity-50'
            )}
            accessibilityRole="button"
            accessibilityState={{ disabled: isBusy, busy: pendingAction === 'withdraw' }}
            accessibilityLabel="Withdraw request"
          >
            {pendingAction === 'withdraw' ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text className="text-sm font-bold text-white font-urbanist">WITHDRAW</Text>
            )}
          </Pressable>
        </View>
        {isWithinResendCooldown && pendingAction !== 'resend' && (
          <Text className="text-xs text-white/50 font-urbanist mt-2 text-center">
            Recently sent — please wait before sending again.
          </Text>
        )}
      </View>
    );
  }

  // Recipient → can ACCEPT or REJECT. A past event can no longer be accepted —
  // it already happened, so disable ACCEPT and explain why. REJECT stays enabled
  // so the recipient can still clear the stale invite. The server rejects an
  // accept on a past event too; this just avoids a guaranteed-to-fail tap.
  // (Asana 1216289752400014)
  const isPastEvent = isEventPast(booking.eventDateStart);
  const acceptDisabled = isBusy || isPastEvent;

  return (
    <View className="mt-3">
      <View className="flex-row gap-3">
        <Pressable
          onPress={onAccept}
          disabled={acceptDisabled}
          className={cn(
            'flex-1 items-center py-2.5 rounded-full bg-[#662FFF] active:opacity-70',
            acceptDisabled && 'opacity-50'
          )}
          accessibilityRole="button"
          accessibilityState={{ disabled: acceptDisabled, busy: pendingAction === 'accept' }}
          accessibilityLabel="Accept request"
        >
          {pendingAction === 'accept' ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text className="text-sm font-bold text-white font-urbanist tracking-wider">
              ACCEPT
            </Text>
          )}
        </Pressable>
        <Pressable
          onPress={onReject}
          disabled={isBusy}
          className={cn(
            'flex-1 items-center py-2.5 rounded-full border border-[#8D8D8D] active:opacity-70',
            isBusy && 'opacity-50'
          )}
          accessibilityRole="button"
          accessibilityState={{ disabled: isBusy, busy: pendingAction === 'reject' }}
          accessibilityLabel="Reject request"
        >
          {pendingAction === 'reject' ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text className="text-sm font-bold text-white font-urbanist tracking-wider">
              REJECT
            </Text>
          )}
        </Pressable>
      </View>
      {isPastEvent && (
        <Text className="text-xs text-white/50 font-urbanist mt-2 text-center">
          This event has already taken place — it can no longer be accepted.
        </Text>
      )}
    </View>
  );
}
