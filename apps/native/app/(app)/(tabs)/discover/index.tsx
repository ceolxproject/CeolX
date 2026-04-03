import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function DiscoverScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#080808' }}>
      <View className="p-4 border-b border-gray-10">
        <Text className="text-2xl font-bold text-white">Discover</Text>
      </View>

      <View className="flex-1 justify-center items-center">
        <Text className="text-base text-gray-10">Browse Irish music events (M4-T2)</Text>
      </View>
    </SafeAreaView>
  );
}
