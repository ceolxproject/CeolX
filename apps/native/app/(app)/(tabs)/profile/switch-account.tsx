import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts/auth-context';

const ROLES = [
  {
    key: 'spectator',
    label: 'Spectator',
    description: 'Discover and follow Irish music events',
  },
  {
    key: 'artist',
    label: 'Artist / Musician',
    description: 'Promote your performances and get booked',
  },
  {
    key: 'venue',
    label: 'Venue / Business / Festival',
    description: 'List gigs and recruit artists (subscription required)',
  },
] as const;

export default function SwitchAccountScreen() {
  const { logout } = useAuth();

  const handleSelect = (_role: (typeof ROLES)[number]['key']) => {
    // Wired in M2-T4
    void _role;
    router.back();
  };

  const handleLogout = async () => {
    // (app)/_layout redirects to sign-in declaratively when the session clears;
    // removing the imperative replace avoids the double-nav flicker on logout.
    await logout();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#080808' }}>
      <View className="flex-1 p-4">
        {/* Header with back button */}
        <View className="flex-row items-center mb-4">
          <Pressable onPress={() => router.back()} hitSlop={8} className="active:opacity-70 mr-3">
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </Pressable>
          <Text className="text-lg font-bold text-white font-urbanist">Settings</Text>
        </View>

        <Text className="text-sm text-gray-10 mb-6 leading-5">
          Choose how you want to use CeolX. You can switch any time from Settings.
        </Text>

        {ROLES.map((role) => (
          <Pressable
            key={role.key}
            className="border border-gray-10 rounded-xl p-4 mb-3"
            onPress={() => handleSelect(role.key)}
          >
            <Text className="text-base font-semibold text-white mb-1">{role.label}</Text>
            <Text className="text-[13px] text-gray-10">{role.description}</Text>
          </Pressable>
        ))}

        <View className="flex-1" />

        <Pressable
          onPress={handleLogout}
          className="border border-red-500/30 rounded-xl py-3.5 items-center mb-4 active:opacity-70"
        >
          <Text className="text-[15px] font-semibold text-red-500 font-urbanist">Log Out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
