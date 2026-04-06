import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts/auth-context';

export default function ProfileScreen() {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/sign-in');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#080808' }}>
      <View className="p-4 border-b border-gray-10">
        <Text className="text-2xl font-bold text-white">Profile</Text>
      </View>

      <View className="items-center py-8">
        <View className="w-20 h-20 rounded-full bg-surface mb-3" />
        <Text className="text-lg font-semibold text-white mb-2">{user?.email ?? '—'}</Text>
        <View className="rounded-full bg-surface px-3 py-1">
          <Text className="text-xs font-medium text-white capitalize">spectator</Text>
        </View>
      </View>

      <View className="mx-4 border border-gray-10 rounded-xl">
        <Pressable
          className="flex-row justify-between items-center px-4 py-3.5"
          onPress={() => router.push('/(app)/(tabs)/profile/edit')}
        >
          <Text className="text-[15px] text-white">Edit Profile</Text>
          <Text className="text-lg text-gray-10">›</Text>
        </Pressable>

        <View className="h-px bg-gray-10" />

        <Pressable
          className="flex-row justify-between items-center px-4 py-3.5"
          onPress={() => router.push('/(app)/(tabs)/profile/switch-account')}
        >
          <Text className="text-[15px] text-white">Switch Account Type</Text>
          <Text className="text-lg text-gray-10">›</Text>
        </Pressable>

        <View className="h-px bg-gray-10" />

        <Pressable
          className="flex-row justify-between items-center px-4 py-3.5"
          onPress={handleLogout}
        >
          <Text className="text-[15px] text-red-500">Logout</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
