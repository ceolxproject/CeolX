import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { layout, ph, typography } from '@/styles/shared';

export default function EventDetailScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();

  return (
    <SafeAreaView style={layout.container}>
      <View style={layout.inner}>
        <Text style={typography.metaLabel}>Event ID</Text>
        <Text style={styles.id}>{eventId}</Text>

        <View style={ph.box}>
          <Text style={ph.text}>Event detail goes here (M4-T2)</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  id: { fontSize: 16, fontWeight: '600', marginBottom: 16 },
});
