import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IRELAND_INITIAL_REGION } from '@CeolX/shared';

import { appToast } from '@/components/AppToast';
import { FeedLocationSheet } from '@/components/FeedLocationSheet';
import { LocationPermissionScreen } from '@/components/LocationPermissionScreen';
import { setBaseLocation } from '@/utils/base-location';
import type { FeedLocation } from '@/utils/feed-location';
import { setLocationSetupComplete } from '@/utils/location-setup';

/**
 * Standalone "Set your location" onboarding step, shown right after signup for
 * ALL personas (the (app) layout guard redirects here until the setup flag is
 * set). Frames the existing location priming as a clear onboarding step.
 *
 * Lives in (auth) — OUTSIDE LocationOverrideProvider — so it must NOT use
 * `useLocationOverride`. It writes only the base location (on manual pick) and
 * the completion flag; the next `useGpsRegion` mount picks the base location up
 * as `source: 'saved'`, so the map centres correctly without a session override.
 */
export default function SetLocationScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [manualVisible, setManualVisible] = useState(false);

  // Persist the completion flag and move on. The flag write can throw (keychain
  // locked / storage error); if it does, surface a toast and STAY on the step —
  // otherwise navigation is skipped silently and the gate loops the user right
  // back here on next launch (the flag never got set).
  const completeAndContinue = useCallback(async () => {
    try {
      await setLocationSetupComplete();
    } catch {
      appToast.error('Could not finish setup', 'Please try again.');
      return;
    }
    router.replace('/(app)/(tabs)/map');
  }, [router]);

  // Detect path (incl. permission denial — priming always calls onDone) OR the
  // user opted to pick manually. Manual opens the picker; everything else
  // completes the step. The user is never blocked: GPS/IP/Ireland fallback covers
  // a denial once they reach the map.
  const handleDone = useCallback(
    async (opts?: { viaManualSelection?: boolean }) => {
      if (opts?.viaManualSelection) {
        setManualVisible(true);
        return;
      }
      await completeAndContinue();
    },
    [completeAndContinue]
  );

  const handleManualConfirm = useCallback(
    async (loc: FeedLocation) => {
      setManualVisible(false);
      try {
        await setBaseLocation(loc);
      } catch {
        appToast.error('Could not save location', 'Please try again.');
        return; // nothing persisted → stay on the step so they can retry
      }
      await completeAndContinue();
    },
    [completeAndContinue]
  );

  const headerSlot = (
    <View className="w-full items-center mb-4">
      <Text className="text-[#D4FC5A] text-[12px] font-bold tracking-[2px] uppercase">
        One last step
      </Text>
    </View>
  );

  return (
    <View className="flex-1 bg-black">
      <LocationPermissionScreen onDone={handleDone} insets={insets} headerSlot={headerSlot} />

      <FeedLocationSheet
        visible={manualVisible}
        initialLat={IRELAND_INITIAL_REGION.latitude}
        initialLng={IRELAND_INITIAL_REGION.longitude}
        onConfirm={handleManualConfirm}
        onClose={() => setManualVisible(false)}
        title="Set your location"
        confirmLabel="Save location"
      />
    </View>
  );
}
