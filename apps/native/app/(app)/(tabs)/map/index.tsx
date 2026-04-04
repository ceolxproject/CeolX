import { Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function MapScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#080808' }}>
      <View className="p-4 border-b border-gray-10">
        <Text className="text-2xl font-bold text-white mb-3">Map</Text>
        <TextInput
          placeholder="Search location or artist..."
          className="border border-gray-10 rounded-lg px-3 py-2 bg-surface text-white"
          placeholderTextColor="#8d8d8d"
        />
      </View>

      <View className="flex-1 justify-center items-center bg-surface">
        <Text className="text-base text-gray-10">Map goes here (M3-T1)</Text>
      </View>
    </SafeAreaView>
  );
}
