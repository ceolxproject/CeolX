import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function EventDetailScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#080808' }}>
      <View className="p-4">
        <Text className="text-xs font-medium text-gray-10 uppercase tracking-wide">Event ID</Text>
        <Text className="text-base font-semibold text-white mb-4">{eventId}</Text>

        <View className="rounded-lg bg-surface p-6 items-center">
          <Text className="text-sm text-gray-10">Event detail goes here (M4-T2)</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
