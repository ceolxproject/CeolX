import * as WebBrowser from 'expo-web-browser';
import { cn } from 'heroui-native';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTrackTicketClick } from '@/hooks/use-track-ticket-click';
import { normalizeOptionalUrl } from '@/utils/normalize-url';

// Shared label style for both CTAs. 11px (down from 12px) with tighter tracking
// — matches the design's 0.24px letter-spacing and lets "Request to Perform"
// fit on one line. `adjustsFontSizeToFit` at the call sites is the safety net
// for the longest labels (e.g. "Book Ticket FOR €1299").
const ctaLabelClass = 'text-[11px] font-bold text-white font-urbanist tracking-wide uppercase';

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
  const insets = useSafeAreaInsets();

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
      className={cn('px-4 pt-3 bg-black gap-2.5', className)}
      // Pad the bottom past the Android system nav bar / iOS home indicator so
      // the CTAs aren't overlapped by the back/home/recents buttons. Falls back
      // to the original 12px spacing on devices with no bottom inset.
      style={{
        paddingBottom: insets.bottom + 12,
        shadowColor: 'rgba(239,239,244,0.25)',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 1,
        shadowRadius: 12,
        elevation: 12,
      }}
    >
      {/* Design order (Figma 1:5459): the outlined "Request to perform" sits
          first/left, the filled "Book Ticket" second/right. 8px gap matches the
          design and gives the two CTAs room to breathe. */}
      <View className="flex-row items-center gap-2">
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
              <Text className={ctaLabelClass} numberOfLines={1} adjustsFontSizeToFit>
                Request to Perform
              </Text>
            )}
          </Pressable>
        )}

        {/* Request already sent — disabled state */}
        {showRequestSent && (
          <View className="flex-1 items-center justify-center rounded-full py-3 border border-white/30">
            <Text
              className={cn(ctaLabelClass, 'text-white/50')}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              Request Sent
            </Text>
          </View>
        )}

        {/* Book Ticket — purple filled. Only shown when there's a link to open. */}
        {showBookTicket && (
          <Pressable
            onPress={handleBookTicket}
            className="flex-1 items-center justify-center rounded-full py-3 bg-blue-10 active:opacity-80"
          >
            <Text className={ctaLabelClass} numberOfLines={1} adjustsFontSizeToFit>
              {ticketLabel}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
