import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { layout, typography } from "@/styles/shared";

export default function DiscoverScreen() {
  return (
    <SafeAreaView style={layout.container}>
      <View style={layout.header}>
        <Text style={typography.screenTitle}>Discover</Text>
      </View>
      <View style={layout.divider} />

      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>
          Browse Irish music events (M4-T2)
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // No background — intentionally different from ph.box
  placeholder: { flex: 1, justifyContent: "center", alignItems: "center" },
  placeholderText: { fontSize: 16, color: "#999" },
});
