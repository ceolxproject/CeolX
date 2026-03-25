import { Link, router } from "expo-router";
import { useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/auth-context";
import { form, layout, typography } from "@/styles/shared";

export default function SignInScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSignIn = async () => {
    // Wired in M2-T1
    await login("mock-token", {
      userId: "mock-id",
      currentRole: "spectator",
      email,
      emailVerified: false,
    });
    router.replace("/(app)/(tabs)/map");
  };

  return (
    <SafeAreaView style={layout.container}>
      <View style={styles.inner}>
        <Text style={typography.authTitle}>Sign In</Text>
        <Text style={typography.authSubtitle}>Welcome back to CeolX</Text>

        <TextInput
          style={form.input}
          placeholder="Email"
          placeholderTextColor="#999"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={form.input}
          placeholder="Password"
          placeholderTextColor="#999"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <Link href="/(auth)/forgot-password" style={styles.forgotLink}>
          Forgot Password?
        </Link>

        <TouchableOpacity
          style={[form.button, { marginBottom: 24 }]}
          onPress={handleSignIn}
        >
          <Text style={form.buttonText}>Sign In</Text>
        </TouchableOpacity>

        <View style={form.footer}>
          <Text style={typography.footerText}>Don't have an account? </Text>
          <Link href="/(auth)/sign-up" style={typography.linkText}>
            Sign Up
          </Link>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  inner: { flex: 1, padding: 24, justifyContent: "center" },
  forgotLink: {
    alignSelf: "flex-end",
    color: "#00a86b",
    fontSize: 14,
    marginBottom: 20,
  },
});
