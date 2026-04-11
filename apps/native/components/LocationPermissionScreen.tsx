import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  /** Called after the user makes a choice (either allow or deny). */
  onDone: () => Promise<void>;
};

/**
 * Pre-permission priming screen. Shown once on first Map tab visit.
 *
 * Mirrors the iOS permission sheet aesthetic so users understand
 * Precise vs Approximate before the native dialog fires.
 *
 * "While using the app" / "Only this time" → trigger native permission → onDone.
 * "Don't allow" → skip GPS, fallback chain (IP → Ireland default) handles it.
 */
export function LocationPermissionScreen({ onDone }: Props) {
  const insets = useSafeAreaInsets();

  async function handleAllow() {
    await Location.requestForegroundPermissionsAsync();
    await onDone();
  }

  return (
    <View className="flex-1 bg-black" style={{ paddingTop: insets.top }}>
      {/* Top — branding + copy */}
      <View className="flex-1 items-center justify-center px-8 gap-3">
        <Text className="text-[#6155F5] text-base font-semibold tracking-[2px]">CEOLX</Text>
        <Text className="text-white text-[32px] font-semibold leading-[42px] tracking-[-1px] w-full">
          Your location please!
        </Text>
        <Text className="text-[#dadada] text-base text-center leading-5 w-full">
          Set your location to start exploring events and gigs around you
        </Text>
      </View>

      {/* Bottom sheet */}
      <View
        className="bg-[#333335] items-center px-6"
        style={{
          paddingBottom: Math.max(insets.bottom + 24, 40),
          shadowColor: 'rgba(179,185,208,0.25)',
          shadowOffset: { width: 0, height: -20 },
          shadowOpacity: 1,
          shadowRadius: 100,
          elevation: 20,
        }}
      >
        {/* Map pin icon — elevated at the top of the sheet */}
        <View className="mt-[-24px] mb-1 bg-[#333335] rounded-full p-1">
          <Ionicons name="location" size={44} color="#D4FC5A" />
        </View>

        {/* Vertical connector line */}
        <View className="w-px h-12 bg-[rgba(255,255,255,0.18)] mb-4" />

        {/* Permission question */}
        <Text className="text-white text-[14px] text-center leading-5 mb-6">
          Allow <Text className="font-bold">CEOLX</Text> to access your location?
        </Text>

        {/* Precise / Approximate visual selector */}
        <View className="flex-row items-start justify-center mb-8">
          {/* Precise — selected */}
          <View className="items-center gap-2 w-[110px]">
            <View className="w-[100px] h-[100px] rounded-full border-[3px] border-[#D4FC5A] bg-[#222224] items-center justify-center overflow-hidden">
              <Ionicons name="locate" size={36} color="#D4FC5A" />
            </View>
            <Text className="text-[#D4FC5A] text-[14px] text-center">Precise</Text>
          </View>

          {/* Vertical divider */}
          <View className="w-px h-[100px] bg-[rgba(255,255,255,0.2)] mx-2 self-center" />

          {/* Approximate */}
          <View className="items-center gap-2 w-[110px]">
            <View className="w-[100px] h-[100px] rounded-full border-[2px] border-[rgba(255,255,255,0.15)] bg-[#222224] items-center justify-center overflow-hidden">
              <Ionicons name="map-outline" size={36} color="rgba(255,255,255,0.6)" />
            </View>
            <Text className="text-[rgba(255,255,255,0.8)] text-[14px] text-center">
              Approximate
            </Text>
          </View>
        </View>

        {/* Permission action buttons */}
        <View className="w-[233px] gap-7 items-center">
          <Pressable onPress={handleAllow} className="w-full">
            <Text className="text-white text-[16px] font-semibold text-center">
              While using the app
            </Text>
          </Pressable>
          <Pressable onPress={handleAllow} className="w-full">
            <Text className="text-white text-[16px] font-semibold text-center">Only this time</Text>
          </Pressable>
          <Pressable onPress={onDone} className="w-full">
            <Text className="text-[#8d8d8d] text-[16px] font-semibold text-center">
              Don't allow
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
