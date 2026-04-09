import * as Location from 'expo-location';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  /** Called after the user makes a choice (either detect or manual). */
  onDone: () => Promise<void>;
};

/**
 * Pre-permission priming screen. Shown once on first Map tab visit.
 *
 * "Detect my location" triggers the native OS permission dialog, then calls onDone.
 * "Select location manually" skips GPS — the fallback chain (IP → Ireland default) handles it.
 */
export function LocationPermissionScreen({ onDone }: Props) {
  const insets = useSafeAreaInsets();

  async function handleDetect() {
    await Location.requestForegroundPermissionsAsync();
    await onDone();
  }

  return (
    <View className="flex-1 bg-black" style={{ paddingTop: insets.top }}>
      {/* Top half — branding + copy */}
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-[#6155F5] text-base font-semibold tracking-[2px] mb-8">CEOLX</Text>
        <Text className="text-white text-[32px] font-semibold leading-[42px] tracking-[-1px] mb-3 text-left w-full px-3">
          Your location please!
        </Text>
        <Text className="text-[#dadada] text-base text-center leading-5 px-3">
          Set your location to start exploring events and gigs around you
        </Text>
      </View>

      {/* Bottom sheet */}
      <View
        className="bg-[#333335] px-6 pt-10"
        style={{
          paddingBottom: Math.max(insets.bottom + 16, 32),
          shadowColor: 'rgba(179,185,208,0.25)',
          shadowOffset: { width: 0, height: -20 },
          shadowOpacity: 1,
          shadowRadius: 100,
          elevation: 20,
        }}
      >
        <Pressable
          onPress={handleDetect}
          className="bg-[#6155F5] py-4 rounded-full items-center justify-center"
        >
          <Text className="text-white text-base font-semibold">Detect my location</Text>
        </Pressable>

        {/* Or separator */}
        <View className="flex-row items-center gap-4 my-6 px-2.5">
          <View className="flex-1 h-px bg-[#7E8492]" />
          <Text className="text-[#7E8492] text-sm font-medium">Or</Text>
          <View className="flex-1 h-px bg-[#7E8492]" />
        </View>

        <Pressable
          onPress={onDone}
          className="bg-[#dadada] py-4 rounded-full items-center justify-center"
        >
          <Text className="text-black text-base font-semibold">Select location manually</Text>
        </Pressable>
      </View>
    </View>
  );
}
