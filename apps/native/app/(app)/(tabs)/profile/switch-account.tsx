import { router } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { layout } from '@/styles/shared';

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
    <SafeAreaView style={layout.container}>
      <View style={layout.inner}>
        <Text style={styles.subtitle}>
          Choose how you want to use CeolX. You can switch any time from Settings.
        </Text>

        {ROLES.map((role) => (
          <TouchableOpacity
            key={role.key}
            style={styles.card}
            onPress={() => handleSelect(role.key)}
          >
            <Text style={styles.cardTitle}>{role.label}</Text>
            <Text style={styles.cardDesc}>{role.description}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  subtitle: { fontSize: 14, color: '#666', marginBottom: 24, lineHeight: 20 },
  card: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  cardDesc: { fontSize: 13, color: '#666' },
});
