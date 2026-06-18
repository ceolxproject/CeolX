import { Text, View } from 'react-native';

/**
 * Small pill showing a profile's persona. Spectators have no public persona, so
 * `null` renders nothing. Kept as a shared component so the Artist/Venue tagging
 * stays visually consistent everywhere it appears (follower/following lists,
 * search results, etc.).
 */
export function ProfileTypeTag({ type }: { type: 'artist' | 'venue' | null }) {
  if (!type) return null;

  return (
    <View className="rounded-[6px] border border-gray-10 px-1.5 py-px">
      <Text className="text-[10px] font-bold uppercase tracking-[0.2px] text-[#8a8a8f] font-urbanist">
        {type === 'artist' ? 'Artist' : 'Venue'}
      </Text>
    </View>
  );
}
