import { cn } from 'heroui-native';
import { Linking, Pressable, Text, View } from 'react-native';

interface StickyBottomBarProps {
  ticketPrice?: number | null;
  ticketLink?: string | null;
  isArtist: boolean;
  isOwner: boolean;
  isVenueEvent: boolean;
  onRequestToPerform: () => void;
  className?: string;
}

export function StickyBottomBar({
  ticketPrice,
  ticketLink,
  isArtist,
  isOwner,
  isVenueEvent,
  onRequestToPerform,
  className,
}: StickyBottomBarProps) {
  const showRequestToPerform = isArtist && isVenueEvent && !isOwner;

  const ticketLabel =
    ticketPrice !== null && ticketPrice !== undefined && ticketPrice > 0
      ? `Book Ticket FOR €${(ticketPrice / 100).toFixed(0)}`
      : 'Book Ticket';

  const handleBookTicket = () => {
    if (ticketLink) void Linking.openURL(ticketLink);
  };

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
        {/* Book Ticket — purple filled */}
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

        {/* Request to Perform — outlined, artists on venue events only */}
        {showRequestToPerform && (
          <Pressable
            onPress={onRequestToPerform}
            className="flex-1 items-center justify-center rounded-full py-3 border border-white active:opacity-80"
          >
            <Text
              className="text-xs font-bold text-white font-urbanist tracking-widest uppercase"
              numberOfLines={1}
            >
              Request to Perform
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
