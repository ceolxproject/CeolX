import { router } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts/auth-context';
import { chip, layout, typography } from '@/styles/shared';

export default function ProfileScreen() {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/sign-in');
  };

  return (
    <SafeAreaView style={layout.container}>
      <View style={layout.header}>
        <Text style={typography.screenTitle}>Profile</Text>
      </View>
      <View style={layout.divider} />

      <View style={styles.profileSection}>
        <View style={styles.avatar} />
        <Text style={styles.name}>{user?.email ?? '—'}</Text>
        <View style={chip.tag}>
          <Text style={[chip.tagText, styles.roleText]}>{user?.currentRole ?? 'spectator'}</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionRow}
          onPress={() => router.push('/(app)/(tabs)/profile/edit')}
        >
          <Text style={styles.actionText}>Edit Profile</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
        <View style={layout.divider} />
        <TouchableOpacity
          style={styles.actionRow}
          onPress={() => router.push('/(app)/(tabs)/profile/switch-account')}
        >
          <Text style={styles.actionText}>Switch Account Type</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
        <View style={layout.divider} />
        <TouchableOpacity style={styles.actionRow} onPress={handleLogout}>
          <Text style={[styles.actionText, styles.logoutText]}>Logout</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  profileSection: { alignItems: 'center', paddingVertical: 32 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#e0e0e0',
    marginBottom: 12,
  },
  name: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  roleText: { fontWeight: '500', textTransform: 'capitalize' },
  actions: {
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  actionText: { fontSize: 15 },
  chevron: { fontSize: 18, color: '#999' },
  logoutText: { color: '#e53e3e' },
});
