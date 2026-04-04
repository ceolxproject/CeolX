import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function BookingsScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#080808' }}>
      <View className="p-4 border-b border-gray-10">
        <Text className="text-2xl font-bold text-white">Bookings</Text>
      </View>

      <View className="flex-1 justify-center items-center p-8">
        <Text className="text-lg font-semibold text-white mb-2">No bookings yet</Text>
        <Text className="text-sm text-gray-10 text-center">
          Your artist and venue bookings will appear here
        </Text>
      </View>
    </SafeAreaView>
  );
}
