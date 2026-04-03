import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ArtistProfileScreen() {
  const { artistId } = useLocalSearchParams<{ artistId: string }>();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#080808' }}>
      <View className="p-4">
        <View className="w-20 h-20 rounded-full bg-surface mb-3" />
        <Text className="text-xs font-medium text-gray-10 uppercase tracking-wide">Artist ID</Text>
        <Text className="text-base font-semibold text-white mb-3">{artistId}</Text>

        <View className="flex-row flex-wrap gap-2 mb-4">
          {['Traditional', 'Trad / Folk'].map((tag) => (
            <View key={tag} className="rounded-full bg-surface px-3 py-1">
              <Text className="text-xs text-white">{tag}</Text>
            </View>
          ))}
        </View>

        <View className="rounded-lg bg-surface p-6 items-center">
          <Text className="text-sm text-gray-10">Artist profile goes here (M6-T1)</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
