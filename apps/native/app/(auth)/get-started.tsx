import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// TODO: replace with concert-bg.jpg from design assets
// Place the file at apps/native/assets/images/concert-bg.jpg

export default function GetStartedScreen() {
  const handleGetStarted = async () => {
    await SecureStore.setItemAsync('hasSeenOnboarding', 'true');
    router.push('/(auth)/who-are-you');
  };

  return (
    <View style={styles.bg}>
      {/* Decorative accent circles — replace with ImageBackground + concert-bg.jpg */}
      <View style={styles.accentCircleLarge} />
      <View style={styles.accentCircleSmall} />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.logoText}>CEOLX</Text>
        </View>

        <View style={styles.content}>
          <Text style={styles.heading}>Discover the sound,{'\n'}Share the Culture.</Text>
          <Text style={styles.body}>
            Experience, perform, and host. Your connection to the live music starts here.
          </Text>

          <TouchableOpacity style={styles.button} onPress={handleGetStarted} activeOpacity={0.85}>
            <Text style={styles.buttonText}>GET STARTED</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    backgroundColor: '#0d0c0f',
    overflow: 'hidden',
  },
  accentCircleLarge: {
    position: 'absolute',
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: 'rgba(103,65,255,0.15)',
    top: -100,
    right: -100,
  },
  accentCircleSmall: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(103,65,255,0.1)',
    bottom: 120,
    left: -60,
  },
  safeArea: { flex: 1 },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  logoText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 4,
  },
  content: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
  heading: {
    fontSize: 36,
    fontWeight: '700',
    color: '#ffffff',
    lineHeight: 40,
    marginBottom: 16,
  },
  body: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 24,
    marginBottom: 40,
  },
  button: {
    backgroundColor: '#662FFF',
    borderRadius: 100,
    paddingVertical: 18,
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 2,
  },
});
