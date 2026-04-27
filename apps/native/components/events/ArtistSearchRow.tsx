import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, Text, View } from 'react-native';

export type ArtistResult = {
  id: string;
  stageName: string;
  genre: string | null;
  image: string | null;
};

interface ArtistSearchRowProps {
  artist: ArtistResult;
  onPress: () => void;
  /** Icon shown on the right side of the row */
  actionIcon?: keyof typeof Ionicons.glyphMap;
  actionIconColor?: string;
}

export function ArtistSearchRow({
  artist,
  onPress,
  actionIcon = 'add-circle-outline',
  actionIconColor = '#6C63FF',
}: ArtistSearchRowProps) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 px-4 py-3 border-b border-gray-8 last:border-b-0 active:bg-white/10"
    >
      {artist.image ? (
        <Image source={{ uri: artist.image }} className="w-8 h-8 rounded-full" />
      ) : (
        <View className="w-8 h-8 rounded-full bg-[#6C63FF]/30 items-center justify-center">
          <Ionicons name="person" size={14} color="#6C63FF" />
        </View>
      )}
      <View className="flex-1">
        <Text className="text-sm text-white font-urbanist">{artist.stageName}</Text>
        {artist.genre && <Text className="text-xs text-gray-7 font-urbanist">{artist.genre}</Text>}
      </View>
      <Ionicons name={actionIcon} size={20} color={actionIconColor} />
    </Pressable>
  );
}
