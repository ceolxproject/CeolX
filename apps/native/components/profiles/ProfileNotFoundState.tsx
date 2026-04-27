import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type ProfileNotFoundProps = {
  entityName: 'Artist' | 'Venue';
};

export function ProfileNotFoundState({ entityName }: ProfileNotFoundProps) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#080808' }}>
      <View className="flex-row items-center px-4 py-3">
        <Pressable onPress={() => router.back()} className="mr-3">
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </Pressable>
      </View>
      <View className="flex-1 items-center justify-center px-6">
        <Ionicons name="person-outline" size={48} color="#8D8D8D" />
        <Text className="text-lg font-semibold text-white mt-3 font-urbanist">
          {entityName} not found
        </Text>
        <Text className="text-sm text-white/60 text-center mt-1 font-urbanist">
          This profile may have been removed or is no longer active.
        </Text>
      </View>
    </SafeAreaView>
  );
}
