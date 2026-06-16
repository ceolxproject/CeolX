import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { ImageBackground, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CeolxLogo } from '@/components/CeolxLogo';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const concertBg = require('@/assets/images/concert-bg.jpg') as number;

export default function GetStartedScreen() {
  const handleGetStarted = async () => {
    await SecureStore.setItemAsync('hasSeenOnboarding', 'true');
    router.push('/(auth)/sign-in');
  };

  return (
    <ImageBackground source={concertBg} style={{ flex: 1 }} resizeMode="cover">
      {/* Dark overlay matching Figma gradient (transparent top → 71% black bottom) */}
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }}>
        <SafeAreaView style={{ flex: 1 }}>
          <View className="flex-1 px-6">
            {/* Logo — upper area */}
            <View className="pt-4 mb-[76px]">
              <CeolxLogo />
            </View>

            {/* Text block */}
            <View className="gap-9 pr-5">
              {/* Heading — Urbanist Bold 36/40 */}
              <Text className="text-[36px] font-bold text-white leading-10 font-sans">
                Discover the sound, Share the Culture.
              </Text>

              {/* Body — Urbanist Regular 16/20 */}
              <Text className="text-base font-normal text-white leading-5 font-sans">
                Experience, perform, and host. Your connection to the live music starts here.
              </Text>
            </View>

            {/* Spacer pushes button to bottom */}
            <View className="flex-1" />

            {/* CTA — Urbanist Bold 17/20 */}
            <Pressable
              onPress={handleGetStarted}
              className="bg-blue-10 rounded-full py-4 px-8 items-center justify-center mb-6"
            >
              <Text className="text-white text-[17px] font-bold leading-5 font-sans">
                GET STARTED
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </ImageBackground>
  );
}
