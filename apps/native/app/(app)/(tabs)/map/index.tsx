import { StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { layout } from '@/styles/shared';

export default function MapScreen() {
  return (
    <SafeAreaView style={layout.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Map</Text>
        <TextInput
          placeholder="Search location or artist..."
          style={styles.searchBar}
          placeholderTextColor="gray"
        />
      </View>

      <View style={styles.mapPlaceholder}>
        <Text style={styles.placeholderText}>Map goes here (M3-T1)</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 12 },
  searchBar: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f5f5f5',
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  placeholderText: { fontSize: 16, color: '#999' },
});
