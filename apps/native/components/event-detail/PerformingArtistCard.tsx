import { Ionicons } from '@expo/vector-icons';
import { cn } from 'heroui-native';
import { Image, Pressable, Text, View } from 'react-native';

import type { EventDetailArtist } from '@/types/event-detail';

interface PerformingArtistCardProps {
  artist: EventDetailArtist;
  onPress?: () => void;
  className?: string;
}

export function PerformingArtistCard({ artist, onPress, className }: PerformingArtistCardProps) {
  return (
    <Pressable
      onPress={onPress}
      // No handler (external invitee) → non-interactive, no press feedback.
      disabled={!onPress}
      className={cn(
        'w-[138px] h-[177px] rounded-lg border border-[#3a3a3a] bg-[rgba(141,141,141,0.3)] overflow-hidden items-center',
        className
      )}
    >
      {/* Avatar */}
      <View className="mt-4">
        {artist.profileImageUrl ? (
          <Image source={{ uri: artist.profileImageUrl }} className="w-16 h-16 rounded-full" />
        ) : (
          <View className="w-16 h-16 rounded-full bg-white/10 items-center justify-center">
            <Ionicons name="person-outline" size={28} color="#8d8d8d" />
          </View>
        )}
      </View>

      {/* Name */}
      <Text
        className="text-[15px] font-bold text-white font-sans text-center mt-2 px-2"
        numberOfLines={1}
      >
        {artist.stageName}
      </Text>

      {/* Genre */}
      {artist.genre && (
        <Text
          className="text-[11px] text-white font-sans text-center mt-0.5 px-2"
          numberOfLines={1}
        >
          {artist.genre}
        </Text>
      )}

      {/* Event count pill — only for registered platform artists.
          External/unregistered performers have no profile, so no event history to show. */}
      {!artist.isExternal && (
        <View className="flex-row items-center bg-white/20 rounded-full px-2 py-1 gap-0.5 mt-auto mb-3">
          <Ionicons name="ticket-outline" size={12} color="#CED1D8" />
          <Text className="text-[13px] text-[#CED1D8] font-sans">{artist.eventCount} events</Text>
        </View>
      )}
    </Pressable>
  );
}
