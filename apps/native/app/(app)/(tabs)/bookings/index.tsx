import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { layout, typography } from '@/styles/shared';

export default function BookingsScreen() {
  return (
    <SafeAreaView style={layout.container}>
      <View style={layout.header}>
        <Text style={typography.screenTitle}>Bookings</Text>
      </View>
      <View style={layout.divider} />

      <View style={styles.empty}>
        <Text style={styles.emptyText}>No bookings yet</Text>
        <Text style={styles.emptySubtext}>Your artist and venue bookings will appear here</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  emptySubtext: { fontSize: 14, color: '#999', textAlign: 'center' },
});
