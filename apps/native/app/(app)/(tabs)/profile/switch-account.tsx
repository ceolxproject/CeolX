import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
    label: 'Venue / Business',
    description: 'List gigs and recruit artists (subscription required)',
  },
] as const;

export default function SwitchAccountScreen() {
  const handleSelect = (_role: (typeof ROLES)[number]['key']) => {
    // Wired in M2-T4
    void _role;
    router.back();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#080808' }}>
      <View className="p-4">
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
      </View>
    </SafeAreaView>
  );
}
