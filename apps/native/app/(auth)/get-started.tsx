import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { ImageBackground, Pressable, ScrollView, Text, View } from 'react-native';
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
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }}>
        <SafeAreaView style={{ flex: 1 }}>
          <View className="flex-1 px-6">
            {/* The copy scrolls, the CTA doesn't. At the largest OS text sizes the
                heading needs more height than the screen has, and this screen is the
                only way into the app — a "Get Started" pushed below the fold is a
                dead end. flexGrow keeps the layout pixel-identical whenever the
                content does fit, which is every default text size. */}
            <ScrollView
              className="flex-1"
              contentContainerStyle={{ flexGrow: 1 }}
              showsVerticalScrollIndicator={false}
            >
              <View className="pt-4 mb-[76px]">
                <CeolxLogo size={40} />
              </View>

              <View className="gap-9">
                {/* Heading — Anton condensed display, multi-color, matching ceolx.com
                    hero. leading must stay >= ~1.2x the font size: Anton's caps are
                    taller than the em box, and iOS clips a glyph to the line height
                    while Android quietly pads it (includeFontPadding). At 44/46 the
                    tops of the capitals were sliced flat on iPhone only. */}
                <Text
                  maxFontSizeMultiplier={1.3}
                  style={{ fontFamily: 'Anton_400Regular' }}
                  className="text-[44px] uppercase leading-[53px] text-white text-center"
                >
                  Discover the <Text className="text-green-10">sound</Text>. Share the{' '}
                  <Text className="text-blue-10">culture</Text>.
                </Text>

                {/* Body — Inter regular, matching site's muted subtitle */}
                <Text
                  maxFontSizeMultiplier={1.3}
                  style={{ fontFamily: 'Inter_400Regular' }}
                  className="text-base font-normal text-white/70 leading-5 text-center"
                >
                  Experience, perform, and host. Your connection to the live music starts here.
                </Text>
              </View>

              {/* Spacer pushes the CTA to the bottom while the content fits, and
                  collapses to nothing once it doesn't. */}
              <View className="flex-1" />
            </ScrollView>

            {/* CTA — green primary pill, matching site's "Download the app" button */}
            <Pressable
              onPress={handleGetStarted}
              className="bg-green-10 rounded-full py-4 px-8 items-center justify-center mb-6"
            >
              <Text
                maxFontSizeMultiplier={1.3}
                style={{ fontFamily: 'JetBrainsMono_700Bold' }}
                className="text-surface-dark text-[17px] uppercase leading-5 tracking-widest"
              >
                GET STARTED
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </ImageBackground>
  );
}
