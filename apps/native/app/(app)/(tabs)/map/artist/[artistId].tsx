import { useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { chip, layout, ph, typography } from "@/styles/shared";

export default function ArtistProfileScreen() {
  const { artistId } = useLocalSearchParams<{ artistId: string }>();

  return (
    <SafeAreaView style={layout.container}>
      <View style={layout.inner}>
        <View style={styles.avatarCircle} />
        <Text style={typography.metaLabel}>Artist ID</Text>
        <Text style={styles.id}>{artistId}</Text>

        <View style={styles.tagRow}>
          {["Traditional", "Trad / Folk"].map((tag) => (
            <View key={tag} style={chip.tag}>
              <Text style={chip.tagText}>{tag}</Text>
            </View>
          ))}
        </View>

        <View style={ph.box}>
          <Text style={ph.text}>Artist profile goes here (M6-T1)</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#e0e0e0",
    marginBottom: 12,
  },
  id: { fontSize: 16, fontWeight: "600", marginBottom: 12 },
  tagRow: { flexDirection: "row", gap: 8, marginBottom: 16, flexWrap: "wrap" },
});
