import { useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { layout, ph, typography } from "@/styles/shared";

export default function BookingDetailScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();

  return (
    <SafeAreaView style={layout.container}>
      <View style={layout.inner}>
        <View style={styles.statusChip}>
          <Text style={styles.statusText}>Pending</Text>
        </View>

        <Text style={typography.metaLabel}>Booking ID</Text>
        <Text style={styles.id}>{bookingId}</Text>

        <View style={styles.row}>
          <View style={styles.partyCard}>
            <Text style={styles.partyLabel}>Artist</Text>
            <Text style={styles.partyName}>— (M5-T1)</Text>
          </View>
          <View style={styles.partyCard}>
            <Text style={styles.partyLabel}>Venue</Text>
            <Text style={styles.partyName}>— (M5-T2)</Text>
          </View>
        </View>

        <View style={ph.box}>
          <Text style={ph.text}>Booking detail goes here (M5-T1)</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  statusChip: {
    alignSelf: "flex-start",
    backgroundColor: "#fff3cd",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 16,
  },
  statusText: { fontSize: 13, color: "#856404", fontWeight: "500" },
  id: { fontSize: 16, fontWeight: "600", marginBottom: 16 },
  row: { flexDirection: "row", gap: 12, marginBottom: 16 },
  partyCard: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    padding: 12,
  },
  partyLabel: { fontSize: 12, color: "#999", marginBottom: 4 },
  partyName: { fontSize: 14, fontWeight: "500" },
});
