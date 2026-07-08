import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { useState } from 'react';
import { Alert, Image, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/AppButton';
import { AppHeader } from '@/components/AppHeader';
import { checkForUpdateManually, getRunningBundleInfo } from '@/lib/check-for-update';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const BRAND_ICON = require('@/assets/images/icon.png') as number;

const UNKNOWN = '—';

export default function AboutScreen() {
  const [busy, setBusy] = useState(false);

  const appVersion = Constants.expoConfig?.version ?? UNKNOWN;
  const channel = Updates.channel ?? 'development';
  const bundleSource = getRunningBundleInfo().source === 'ota' ? 'OTA update' : 'embedded';

  async function handleCheck() {
    if (busy) return;
    setBusy(true);
    const result = await checkForUpdateManually();
    setBusy(false);

    switch (result.status) {
      case 'disabled':
        Alert.alert('Updates unavailable', "Over-the-air updates aren't available in this build.");
        break;
      case 'up_to_date':
        Alert.alert("You're up to date", 'You already have the latest version of CeolX.');
        break;
      case 'applied':
        Alert.alert(
          'Update ready',
          'A new version has been downloaded. Restart now to apply it?',
          [
            {
              text: 'Restart',
              onPress: () => {
                Updates.reloadAsync().catch((err) => {
                  // The update stays staged and applies on the next cold launch,
                  // so we keep the dialog silent — but capture the rejection so a
                  // genuinely broken reload (corrupt bundle, native crash) stays
                  // diagnosable, like the error branch below.
                  Sentry.captureException(
                    err instanceof Error
                      ? err
                      : new Error(`OTA manual reload failed: ${String(err)}`),
                    { tags: { module: 'ota-update', op: 'manual_reload' } }
                  );
                });
              },
            },
          ],
          { cancelable: false }
        );
        break;
      case 'error':
        // Keep the raw native error out of the user-facing dialog (it leaks
        // confusing internals), but capture it so real OTA failures stay
        // diagnosable.
        Sentry.captureException(new Error(`OTA manual check failed: ${result.message}`), {
          tags: { module: 'ota-update', op: 'manual_check' },
        });
        Alert.alert(
          'Something went wrong',
          "We couldn't check for updates right now. Please try again later."
        );
        break;
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0d0c0f' }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <AppHeader leading="back" />

        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingBottom: 48 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Brand */}
          <View className="items-center pt-8">
            <View className="h-20 w-20 items-center justify-center overflow-hidden rounded-3xl">
              <Image source={BRAND_ICON} resizeMode="cover" style={{ height: 80, width: 80 }} />
            </View>
            <Text className="mt-5 text-[28px] font-bold text-white font-sans">CeolX</Text>
            <Text className="mt-1.5 text-center text-[15px] text-gray-10 font-inter">
              Discover Irish music near you
            </Text>
          </View>

          {/* Version card */}
          <View className="mt-10 rounded-2xl bg-white/[0.04] border border-white/[0.06] px-5 py-5">
            <Text
              className="text-3xl font-bold text-white font-sans"
              style={{ fontVariant: ['tabular-nums'] }}
            >
              v{appVersion}
            </Text>
            <Text className="mt-1 text-sm text-gray-10 font-inter">
              {channel} · {bundleSource}
            </Text>
          </View>

          {/* Check for updates */}
          <View className="mt-8">
            <AppButton
              variant="primary"
              isLoading={busy}
              onPress={handleCheck}
              accessibilityLabel="Check for updates"
              className="w-full rounded-full py-4"
            >
              {busy ? 'CHECKING…' : 'CHECK FOR UPDATES'}
            </AppButton>
            <Text className="mt-3 text-center text-xs text-gray-10 font-inter">
              Pull the latest fixes and improvements.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
