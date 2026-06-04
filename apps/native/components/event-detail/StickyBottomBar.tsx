import * as WebBrowser from 'expo-web-browser';
import { cn } from 'heroui-native';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';

import { useTrackTicketClick } from '@/hooks/use-track-ticket-click';
import { normalizeOptionalUrl } from '@/utils/normalize-url';

interface StickyBottomBarProps {
  eventId: string;
  ticketPrice?: number | null;
  ticketLink?: string | null;
  isArtist: boolean;
  isOwner: boolean;
  isVenueEvent: boolean;
  isCollaborator?: boolean;
  isRequesting?: boolean;
  hasExistingRequest?: boolean;
  onRequestToPerform: () => void;
  className?: string;
}

export function StickyBottomBar({
  eventId,
  ticketPrice,
  ticketLink,
  isArtist,
  isOwner,
  isVenueEvent,
  isCollaborator,
  isRequesting,
  hasExistingRequest,
  onRequestToPerform,
  className,
}: StickyBottomBarProps) {
  const trackClick = useTrackTicketClick();

  const showRequestToPerform =
    isArtist && isVenueEvent && !isOwner && !isCollaborator && !hasExistingRequest;
  const showRequestSent =
    isArtist && isVenueEvent && !isOwner && !isCollaborator && !!hasExistingRequest;

  // A "Book Ticket" CTA only makes sense when there's actually a link to open.
  // Gate the button on the link (not the price) so we never render a dead
  // button. normalizeOptionalUrl prepends https:// for scheme-less links that
  // may arrive from non-app sources (admin web, seed, API), which would
  // otherwise make Linking/WebBrowser fail to open.
  const bookableUrl = normalizeOptionalUrl(ticketLink ?? undefined);
  const showBookTicket = !!bookableUrl;

  const ticketLabel =
    ticketPrice !== null && ticketPrice !== undefined && ticketPrice > 0
      ? `Book Ticket FOR €${(ticketPrice / 100).toFixed(0)}`
      : 'Book Ticket';

  const handleBookTicket = async () => {
    if (!bookableUrl) return;
    // Fire-and-forget click tracking before opening the external URL.
    // Failures are silent — analytics must not block the user from buying tickets.
    trackClick.mutate({ id: eventId });
    try {
      // In-app browser keeps the user inside CeolX during the purchase flow.
      await WebBrowser.openBrowserAsync(bookableUrl);
    } catch {
      // Surface failures instead of silently swallowing them (the original bug).
      Alert.alert(
        'Unable to open ticket link',
        "We couldn't open the ticket page. Please try again later."
      );
    }
  };

  // Nothing actionable for this viewer — don't render an empty bar.
  if (!showBookTicket && !showRequestToPerform && !showRequestSent) {
    return null;
  }

  return (
    <View
      className={cn('px-4 py-3 bg-black gap-2.5', className)}
      style={{
        shadowColor: 'rgba(239,239,244,0.25)',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 1,
        shadowRadius: 12,
        elevation: 12,
      }}
    >
      <View className="flex-row items-center gap-3">
        {/* Book Ticket — purple filled. Only shown when there's a link to open. */}
        {showBookTicket && (
          <Pressable
            onPress={handleBookTicket}
            className="flex-1 items-center justify-center rounded-full py-3 bg-blue-10 active:opacity-80"
          >
            <Text
              className="text-xs font-bold text-white font-urbanist tracking-widest uppercase"
              numberOfLines={1}
            >
              {ticketLabel}
            </Text>
          </Pressable>
        )}

        {/* Request to Perform — outlined, artists on venue events only */}
        {showRequestToPerform && (
          <Pressable
            onPress={onRequestToPerform}
            disabled={isRequesting}
            className={cn(
              'flex-1 items-center justify-center rounded-full py-3 border border-white active:opacity-80',
              isRequesting && 'opacity-50'
            )}
          >
            {isRequesting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text
                className="text-xs font-bold text-white font-urbanist tracking-widest uppercase"
                numberOfLines={1}
              >
                Request to Perform
              </Text>
            )}
          </Pressable>
        )}

        {/* Request already sent — disabled state */}
        {showRequestSent && (
          <View className="flex-1 items-center justify-center rounded-full py-3 border border-white/30">
            <Text
              className="text-xs font-bold text-white/50 font-urbanist tracking-widest uppercase"
              numberOfLines={1}
            >
              Request Sent
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
