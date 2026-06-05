import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { CeolxLogo } from './CeolxLogo';

type Props = {
  /** Called after the user makes a location choice. */
  onDone: () => Promise<void>;
  /**
   * Safe-area insets, passed from the screen that hosts the Modal. The Modal's
   * own native window can't measure its insets reliably on Android (bottom
   * reports 0), so the host reads them inside the root SafeAreaProvider and
   * forwards them here.
   */
  insets: EdgeInsets;
};

/**
 * Location priming screen (Figma 1:4696).
 *
 * Full-black priming screen. "DETECT MY LOCATION" fires the native OS
 * permission prompt directly — the OS dialog already lets the user pick
 * Precise vs Approximate, so we don't duplicate that choice in-app.
 * "SELECT LOCATION MANUALLY" skips GPS entirely (fallback chain handles it).
 */
export function LocationPermissionScreen({ onDone, insets }: Props) {
  // When permission was hard-denied (denied + cannot ask again), the OS will not
  // show its dialog anymore, so the only way to grant is via Settings. Reflect
  // that on the CTA so the button doesn't promise something it can't do.
  const [settingsOnly, setSettingsOnly] = useState(false);

  useEffect(() => {
    Location.getForegroundPermissionsAsync()
      .then((p) => setSettingsOnly(p.status === Location.PermissionStatus.DENIED && !p.canAskAgain))
      .catch(() => {});
  }, []);

  async function handleDetectPress() {
    const current = await Location.getForegroundPermissionsAsync();

    if (current.status === Location.PermissionStatus.GRANTED) {
      await onDone();
      return;
    }

    if (current.canAskAgain) {
      // First ask, or OS still allows a re-prompt → show the native dialog.
      await Location.requestForegroundPermissionsAsync();
    } else {
      // Hard-denied → the OS won't prompt again; Settings is the only path.
      await Linking.openSettings();
    }

    await onDone();
  }

  return (
    <View
      className="flex-1 bg-black"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <View className="flex-1 items-center px-6 pt-6 pb-6">
        {/* CEOLX logo */}
        <View className="mb-12">
          <CeolxLogo fontSize={18} letterSpacing={2} />
        </View>

        {/* Heading — Urbanist Bold 28px / 32px lh */}
        <Text className="text-white text-[28px] font-bold leading-8 text-center mb-3">
          Your location please!
        </Text>

        {/* Subtitle */}
        <Text className="text-[#dadada] text-base text-center leading-5 mb-10 w-full">
          {settingsOnly
            ? 'Location access is turned off. Enable it in Settings to detect your location — or pick it manually below.'
            : 'Set your location to start exploring events, artists and venues around you!'}
        </Text>

        {/* DETECT MY LOCATION / OPEN SETTINGS pill button */}
        <Pressable
          onPress={handleDetectPress}
          className="bg-[#6155F5] h-14 rounded-full items-center justify-center w-full mb-6"
        >
          <Text className="text-white text-base font-semibold tracking-widest uppercase">
            {settingsOnly ? 'Open settings' : 'Detect my location'}
          </Text>
        </Pressable>

        {/* Or separator */}
        <View className="flex-row items-center w-full mb-6">
          <View className="flex-1 h-px bg-[#7E8492]" />
          <Text className="text-[#7E8492] text-sm font-medium mx-4">Or</Text>
          <View className="flex-1 h-px bg-[#7E8492]" />
        </View>

        {/* SELECT LOCATION MANUALLY — lime text link */}
        <Pressable onPress={onDone}>
          <Text className="text-[#D4FC5A] text-[12px] font-bold tracking-[2px] uppercase">
            Select location manually
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
