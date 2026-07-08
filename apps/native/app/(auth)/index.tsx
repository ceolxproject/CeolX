import * as Sentry from '@sentry/react-native';
import { router, useIsFocused } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { Circle, Path, Svg } from 'react-native-svg';

import { CeolxLogo } from '@/components/CeolxLogo';
import { useAuth } from '@/contexts/auth-context';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// Decorative ring circles — center is off-screen top-right, radii chosen
// to match the Figma design where two arcs are visible in the upper corner.
const RING_CX = SCREEN_W;
const RING_CY = -SCREEN_H * 0.05;
const RING_R1 = SCREEN_W * 0.64; // outer ring
const RING_R2 = SCREEN_W * 0.565; // inner ring

// Green sparkle — computed on the outer ring arc so it always sits on the line.
const SPARK_ANGLE = (126.2 * Math.PI) / 180;
const SPARK_X = RING_CX + RING_R1 * Math.cos(SPARK_ANGLE);
const SPARK_Y = RING_CY + RING_R1 * Math.sin(SPARK_ANGLE);

/**
 * 4-pointed star path centred at (cx, cy) with outer radius r.
 * Uses cubic bezier curves for the soft-tapered point look from the design.
 */
function sparkPath(cx: number, cy: number, r: number): string {
  const c = r * 0.22;
  return [
    `M ${cx} ${cy - r}`,
    `C ${cx + c} ${cy - c} ${cx + c} ${cy - c} ${cx + r} ${cy}`,
    `C ${cx + c} ${cy + c} ${cx + c} ${cy + c} ${cx} ${cy + r}`,
    `C ${cx - c} ${cy + c} ${cx - c} ${cy + c} ${cx - r} ${cy}`,
    `C ${cx - c} ${cy - c} ${cx - c} ${cy - c} ${cx} ${cy - r}`,
    'Z',
  ].join(' ');
}

/**
 * Splash screen — shown on every cold start.
 * Routes based on session and onboarding state:
 *   - active session  → (app) layout handles redirect to map
 *   - seen onboarding → sign-in
 *   - new user        → get-started
 */
export default function SplashScreen() {
  const { user, isLoading } = useAuth();
  // This screen is the (auth) group anchor, so a deep-link cold-start (e.g.
  // ceolx://reset-password?token=…) mounts it *underneath* the linked screen.
  // Without this guard its auto-redirect timer below would fire while
  // reset-password is on top and replace it with sign-in, dropping the token.
  // Only navigate when the splash is the screen actually in focus.
  const isFocused = useIsFocused();
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    SecureStore.getItemAsync('hasSeenOnboarding')
      .then((value) => setHasSeenOnboarding(value === 'true'))
      .catch(() => setHasSeenOnboarding(false));
  }, []);

  useEffect(() => {
    // Only route once the session has resolved AND this splash is the actually
    // focused screen (nothing — e.g. a deep-linked reset-password — sits on top).
    // The navigator is kept mounted at all times (app/_layout, (auth)/_layout),
    // so Expo Router restores a cold-start deep link deterministically and this
    // anchor is reliably unfocused while one is active. No timer / no useURL
    // guard: both were patches for the remount race that is now gone.
    if (isLoading || !isFocused || hasSeenOnboarding === null) return;

    const target = user
      ? '/(app)/(tabs)/map'
      : hasSeenOnboarding
        ? '/(auth)/sign-in'
        : '/(auth)/get-started';

    // Breadcrumb so any stray bounce is diagnosable from Sentry: a deep-linked
    // screen on top would have made this effect bail on !isFocused, so a redirect
    // logged here when a deep link was expected pinpoints a focus/restore gap.
    Sentry.addBreadcrumb({
      category: 'navigation',
      level: 'info',
      message: 'splash redirect',
      data: { target, hasUser: !!user, hasSeenOnboarding },
    });

    router.replace(target);
  }, [isLoading, user, isFocused, hasSeenOnboarding]);

  return (
    <View className="flex-1 bg-[#0d0c0f] items-center justify-center">
      {/* Decorative rings — top-right corner, partially off-screen */}
      <Svg style={StyleSheet.absoluteFill} width={SCREEN_W} height={SCREEN_H}>
        <Circle
          cx={RING_CX}
          cy={RING_CY}
          r={RING_R1}
          stroke="white"
          strokeWidth={1}
          fill="none"
          opacity={0.9}
        />
        <Circle
          cx={RING_CX}
          cy={RING_CY}
          r={RING_R2}
          stroke="white"
          strokeWidth={1}
          fill="none"
          opacity={0.9}
        />
        {/* Green 4-pointed sparkle at the arc intersection */}
        <Path d={sparkPath(SPARK_X, SPARK_Y, 8)} fill="#A7F46A" />
      </Svg>

      <CeolxLogo size={60} />
    </View>
  );
}
