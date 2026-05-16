import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRef, useState } from 'react';
import { Animated, Dimensions, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  /** Called after the user makes a location choice. */
  onDone: () => Promise<void>;
};

const SCREEN_HEIGHT = Dimensions.get('window').height;
// Sheet top = 333px on a 812px Figma canvas (~41%)
const SHEET_TOP = SCREEN_HEIGHT * (333 / 812);

/**
 * Two-state location priming flow:
 *
 * State 1 (initial — Figma 1:4696):
 *   Full-black priming screen. "DETECT MY LOCATION" triggers the sheet.
 *   "SELECT LOCATION MANUALLY" skips GPS entirely.
 *
 * State 2 (sheet — Figma 1:4709):
 *   Dark overlay + #333335 sheet slides up. Shows the custom permission
 *   dialog with Precise/Approximate selectors and allow/deny buttons.
 *   "While using the app" / "Only this time" → native permission → onDone.
 *   "Don't allow" → onDone (fallback chain handles location).
 */
export function LocationPermissionScreen({ onDone }: Props) {
  const insets = useSafeAreaInsets();
  const [sheetVisible, setSheetVisible] = useState(false);
  const sheetAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  function handleDetectPress() {
    setSheetVisible(true);
    Animated.parallel([
      Animated.spring(sheetAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 12,
      }),
      Animated.timing(overlayAnim, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start();
  }

  async function handleAllow() {
    await Location.requestForegroundPermissionsAsync();
    await onDone();
  }

  return (
    <View
      className="flex-1 bg-black"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      {/* ── State 1: Priming screen (Figma 1:4696) ── */}
      <View className="flex-1 items-center px-6 pt-6 pb-6">
        {/* CEOLX logo */}
        <Text className="text-[#6155F5] text-lg font-bold tracking-[2px] mb-12">CEOLX</Text>

        {/* Heading — Urbanist Bold 28px / 32px lh */}
        <Text className="text-white text-[28px] font-bold leading-8 text-center mb-3">
          Your location please!
        </Text>

        {/* Subtitle */}
        <Text className="text-[#dadada] text-base text-center leading-5 mb-10 w-full">
          Set your location to start exploring events, artists and venues around you!
        </Text>

        {/* DETECT MY LOCATION pill button */}
        <Pressable
          onPress={handleDetectPress}
          className="bg-[#6155F5] h-14 rounded-full items-center justify-center w-full mb-6"
        >
          <Text className="text-white text-base font-semibold tracking-widest uppercase">
            Detect my location
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

      {/* ── State 2: Permission sheet overlay (Figma 1:4709) ── */}
      {sheetVisible && (
        <>
          {/* Semi-transparent dark overlay */}
          <Animated.View
            className="absolute inset-0 bg-black"
            style={{
              opacity: overlayAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] }),
            }}
            pointerEvents="none"
          />

          {/* Sliding permission sheet */}
          <Animated.View
            className="absolute left-0 right-0 bottom-0 bg-[#333335] items-center px-6"
            style={{
              top: SHEET_TOP,
              transform: [{ translateY: sheetAnim }],
              paddingBottom: Math.max(insets.bottom + 24, 40),
              shadowColor: 'rgba(179,185,208,0.25)',
              shadowOffset: { width: 0, height: -20 },
              shadowOpacity: 1,
              shadowRadius: 100,
              elevation: 24,
            }}
          >
            {/* Map pin icon */}
            <View className="mt-5 mb-1">
              <Ionicons name="location" size={48} color="#D4FC5A" />
            </View>

            {/* Vertical connector line — 84px as per Figma 1:4726 */}
            <View className="w-px h-[84px] bg-[rgba(255,255,255,0.2)] mb-4" />

            {/* Permission question */}
            <Text className="text-white text-[14px] text-center leading-5 mb-6">
              Allow <Text className="font-bold">CEOLX</Text> to access your location?
            </Text>

            {/* Precise / Approximate visual selector */}
            <View className="flex-row items-start justify-center mb-8">
              {/* Precise — selected state */}
              <View className="items-center gap-2 w-[110px]">
                <View className="w-[100px] h-[100px] rounded-full border-[3px] border-[#D4FC5A] bg-[#222224] items-center justify-center">
                  <Ionicons name="locate" size={36} color="#D4FC5A" />
                </View>
                <Text className="text-[#D4FC5A] text-[14px] text-center">Precise</Text>
              </View>

              {/* Divider */}
              <View className="w-px h-[100px] bg-[rgba(255,255,255,0.2)] mx-2 self-center" />

              {/* Approximate */}
              <View className="items-center gap-2 w-[110px]">
                <View className="w-[100px] h-[100px] rounded-full border-2 border-[rgba(255,255,255,0.15)] bg-[#222224] items-center justify-center">
                  <Ionicons name="map-outline" size={36} color="rgba(255,255,255,0.6)" />
                </View>
                <Text className="text-[rgba(255,255,255,0.8)] text-[14px] text-center">
                  Approximate
                </Text>
              </View>
            </View>

            {/* Permission action buttons — gap-7 (28px) as per Figma 1:4740 */}
            <View className="w-[233px] gap-7 items-center">
              <Pressable onPress={handleAllow} className="w-full">
                <Text className="text-white text-[16px] font-semibold text-center">
                  While using the app
                </Text>
              </Pressable>
              <Pressable onPress={handleAllow} className="w-full">
                <Text className="text-white text-[16px] font-semibold text-center">
                  Only this time
                </Text>
              </Pressable>
              <Pressable onPress={onDone} className="w-full">
                <Text className="text-[#8d8d8d] text-[16px] font-semibold text-center">
                  Don't allow
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        </>
      )}
    </View>
  );
}
