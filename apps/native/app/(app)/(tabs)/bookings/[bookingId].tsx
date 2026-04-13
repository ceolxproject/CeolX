import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function BookingDetailScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#080808' }}>
      <View className="p-4">
        <View className="self-start bg-yellow-900/30 rounded-md px-2.5 py-1 mb-4">
          <Text className="text-[13px] text-yellow-400 font-medium">Pending</Text>
        </View>

        <Text className="text-xs font-medium text-gray-10 uppercase tracking-wide">Booking ID</Text>
        <Text className="text-base font-semibold text-white mb-4">{bookingId}</Text>

        <View className="flex-row gap-3 mb-4">
          <View className="flex-1 bg-surface rounded-lg p-3">
            <Text className="text-xs text-gray-10 mb-1">Artist</Text>
            <Text className="text-sm font-medium text-white">— (M5-T1)</Text>
          </View>
          <View className="flex-1 bg-surface rounded-lg p-3">
            <Text className="text-xs text-gray-10 mb-1">Venue</Text>
            <Text className="text-sm font-medium text-white">— (M5-T2)</Text>
          </View>
        </View>

        <View className="rounded-lg bg-surface p-6 items-center">
          <Text className="text-sm text-gray-10">Booking detail goes here (M5-T1)</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
