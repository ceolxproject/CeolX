import { cn } from 'heroui-native';
import { Image, Pressable, Text, View } from 'react-native';

import type { EventDetailArtist, EventDetailCreator } from '@/types/event-detail';

interface HostArtistInfoBoxProps {
  creator: EventDetailCreator;
  collaborators: EventDetailArtist[];
  onViewAll?: () => void;
  className?: string;
}

export function HostArtistInfoBox({
  creator,
  collaborators,
  onViewAll,
  className,
}: HostArtistInfoBoxProps) {
  const displayedCollaborators = collaborators.slice(0, 3);
  const remainingCount = collaborators.length - displayedCollaborators.length;

  return (
    <View
      className={cn('border border-[rgba(141,141,141,0.5)] rounded-md px-4 py-3 mt-3', className)}
    >
      {/* Host row */}
      <View className="flex-row items-center">
        <Text className="text-sm font-bold text-white font-sans w-[52px]">Host</Text>
        <View className="flex-row items-center gap-1 flex-1">
          {creator.imageUrl ? (
            <Image source={{ uri: creator.imageUrl }} className="w-4 h-4 rounded-full" />
          ) : (
            <View className="w-4 h-4 rounded-full bg-gray-10 items-center justify-center">
              <Text className="text-[8px] text-white">{creator.name.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <Text className="text-xs font-semibold text-white font-sans" numberOfLines={1}>
            By {creator.name}
          </Text>
        </View>
      </View>

      {/* Divider line (horizontal, inside box at midpoint) */}
      <View className="h-px bg-[rgba(141,141,141,0.5)] my-3" />

      {/* Artist row */}
      {collaborators.length > 0 && (
        <View className="flex-row items-center">
          <Text className="text-sm font-bold text-white font-sans w-[52px]">Artist</Text>
          <View className="flex-row items-center gap-1 flex-1">
            {/* Stacked avatars */}
            <View className="flex-row items-center mr-1">
              {displayedCollaborators.map((artist, index) => (
                <View
                  key={artist.id}
                  className="w-4 h-4 rounded-full bg-gray-10 border border-surface-dark"
                  style={{ marginLeft: index > 0 ? -4 : 0 }}
                >
                  {artist.profileImageUrl ? (
                    <Image
                      source={{ uri: artist.profileImageUrl }}
                      className="w-full h-full rounded-full"
                    />
                  ) : null}
                </View>
              ))}
            </View>
            <Text className="text-xs font-semibold text-white font-sans flex-1" numberOfLines={2}>
              {displayedCollaborators[0]?.stageName}
              {remainingCount > 0 ? ` & ${remainingCount} others` : ''}
            </Text>
          </View>

          {onViewAll && (
            <Pressable onPress={onViewAll} hitSlop={8} className="active:opacity-70">
              <Text className="text-xs font-bold text-green-10 tracking-wider uppercase font-sans">
                VIEW ALL
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}
