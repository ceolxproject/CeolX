import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { layout } from "@/styles/shared";

export default function VerifyEmailScreen() {
  const handleResend = () => {
    // Wired in M2-T1
  };

  return (
    <SafeAreaView style={layout.container}>
      <View style={styles.inner}>
        <Text style={styles.icon}>✉️</Text>
        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.body}>
          We've sent a verification link to your email address. Click the link
          to activate your account.
        </Text>

        <TouchableOpacity style={styles.button} onPress={handleResend}>
          <Text style={styles.buttonText}>Resend Email</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  inner: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  icon: { fontSize: 56, marginBottom: 24 },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 12,
    textAlign: "center",
  },
  body: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
  },
  // Outlined variant — different from form.button (green border, transparent bg)
  button: {
    borderWidth: 1.5,
    borderColor: "#00a86b",
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: "center",
  },
  buttonText: { color: "#00a86b", fontSize: 16, fontWeight: "600" },
});
