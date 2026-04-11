import { Ionicons } from '@expo/vector-icons';
import { cn } from 'heroui-native';
import { Pressable, Text, View } from 'react-native';

interface StickyBottomBarProps {
  ticketPrice?: number;
  isArtist: boolean;
  isGigOpportunity: boolean;
  isSaved: boolean;
  onToggleSave: () => void;
  onRequestToPerform: () => void;
  className?: string;
}

export function StickyBottomBar({
  ticketPrice,
  isArtist,
  isGigOpportunity,
  isSaved,
  onToggleSave,
  onRequestToPerform,
  className,
}: StickyBottomBarProps) {
  const showRequestToPerform = isArtist && isGigOpportunity;

  const priceLabel =
    ticketPrice !== undefined && ticketPrice !== null
      ? `€${(ticketPrice / 100).toFixed(0)}`
      : 'Free';

  return (
    <View
      className={cn('px-4 py-2.5 bg-black gap-2.5', className)}
      style={{
        shadowColor: 'rgba(239,239,244,0.25)',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 1,
        shadowRadius: 12,
        elevation: 12,
      }}
    >
      {/* Request to Perform — artists only, gig opportunities only */}
      {showRequestToPerform && (
        <Pressable
          onPress={onRequestToPerform}
          className="flex-row items-center justify-center rounded-full py-3 px-8 bg-green-10 active:opacity-90"
        >
          <Text className="text-base font-bold text-black tracking-wider uppercase font-sans">
            Request to Perform
          </Text>
        </Pressable>
      )}

      {/* Price display + Save — visible to everyone */}
      <View className="flex-row items-center gap-2.5">
        <View className="flex-1 flex-row items-center justify-center rounded-full py-3 px-8 bg-[#6155F5]">
          <Ionicons name="pricetag-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
          <Text className="text-base font-bold text-white font-sans">
            Ticket Price: {priceLabel}
          </Text>
        </View>

        <Pressable
          onPress={onToggleSave}
          className="w-[45px] h-[45px] rounded-full bg-[#2a2a2a] items-center justify-center active:opacity-80"
        >
          <Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={23} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}
