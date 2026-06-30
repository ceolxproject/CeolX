import { cn } from 'heroui-native';
import { Image, Pressable, Text, View } from 'react-native';

import type { EventDetailArtist, EventDetailCreator } from '@/types/event-detail';
import { MOCK_PROFILE_IMAGE } from '@/utils/mock-images';

interface HostArtistInfoBoxProps {
  creator: EventDetailCreator;
  collaborators: EventDetailArtist[];
  onViewAll?: () => void;
  onPressCreator?: (creator: EventDetailCreator) => void;
  onPressArtist?: (artistId: string) => void;
  className?: string;
}

export function HostArtistInfoBox({
  creator,
  collaborators,
  onViewAll,
  onPressCreator,
  onPressArtist,
  className,
}: HostArtistInfoBoxProps) {
  const displayedCollaborators = collaborators.slice(0, 3);
  const remainingCount = collaborators.length - displayedCollaborators.length;
  // The summary row links to the first artist — but external invitees have no
  // profile, so the row is non-tappable when the lead artist is external.
  const leadArtist = displayedCollaborators[0];
  const leadIsTappable = !!leadArtist && !leadArtist.isExternal;

  return (
    <View className={cn('border border-[rgba(141,141,141,0.5)] rounded-md px-4 py-3', className)}>
      {/* Host row */}
      <View className="flex-row items-center">
        <Text className="text-sm font-bold text-white font-sans w-[52px]">Host</Text>
        <Pressable
          className="flex-row items-center gap-1 flex-1 active:opacity-70"
          onPress={() => onPressCreator?.(creator)}
          hitSlop={4}
        >
          <Image
            source={creator.imageUrl ? { uri: creator.imageUrl } : MOCK_PROFILE_IMAGE}
            className="w-4 h-4 rounded-full"
          />
          <Text className="text-xs font-semibold text-white font-sans" numberOfLines={1}>
            By {creator.name}
          </Text>
        </Pressable>
      </View>

      {/* Divider + Artist row — only when at least one artist is present */}
      {collaborators.length > 0 && (
        <>
          <View className="h-px bg-[rgba(141,141,141,0.5)] my-3" />
          <View className="flex-row items-center">
            <Text className="text-sm font-bold text-white font-sans w-[52px]">Artist</Text>
            <Pressable
              className="flex-row items-center gap-1 flex-1 active:opacity-70"
              onPress={leadIsTappable ? () => onPressArtist?.(leadArtist.id) : undefined}
              disabled={!leadIsTappable}
              hitSlop={4}
            >
              {/* Stacked avatars */}
              <View className="flex-row items-center mr-1">
                {displayedCollaborators.map((artist, index) => (
                  <View
                    key={artist.id}
                    className="w-4 h-4 rounded-full bg-gray-10 border border-surface-dark"
                    style={{ marginLeft: index > 0 ? -4 : 0 }}
                  >
                    <Image
                      source={
                        artist.profileImageUrl
                          ? { uri: artist.profileImageUrl }
                          : MOCK_PROFILE_IMAGE
                      }
                      className="w-full h-full rounded-full"
                    />
                  </View>
                ))}
              </View>
              <Text className="text-xs font-semibold text-white font-sans flex-1" numberOfLines={2}>
                {displayedCollaborators[0]?.stageName}
                {remainingCount > 0 ? ` & ${remainingCount} others` : ''}
              </Text>
            </Pressable>

            {onViewAll && (
              <Pressable onPress={onViewAll} hitSlop={8} className="active:opacity-70">
                <Text className="text-xs font-bold text-green-10 tracking-wider uppercase font-sans">
                  VIEW ALL
                </Text>
              </Pressable>
            )}
          </View>
        </>
      )}
    </View>
  );
}
