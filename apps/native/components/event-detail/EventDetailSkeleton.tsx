import { cn } from 'heroui-native';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface EventDetailSkeletonProps {
  className?: string;
}

export function EventDetailSkeleton({ className }: EventDetailSkeletonProps) {
  const insets = useSafeAreaInsets();
  // Honour the OS "reduce motion" setting — fall back to a static placeholder.
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(reduceMotion ? 1 : 0.5);

  useEffect(() => {
    if (reduceMotion) return;
    pulse.value = withRepeat(
      withTiming(1, { duration: 750, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [reduceMotion, pulse]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    // Match the live screen's background (#363636) so there's no dark flash on swap.
    <View className={cn('flex-1 bg-background px-4', className)} style={{ paddingTop: insets.top }}>
      {/* Header placeholder */}
      <View className="flex-row items-center justify-between h-14">
        <View className="w-6 h-6 rounded bg-white/10" />
        <View className="w-20 h-4 rounded bg-white/10" />
        <View className="flex-row gap-4">
          <View className="w-6 h-6 rounded bg-white/10" />
          <View className="w-6 h-6 rounded bg-white/10" />
        </View>
      </View>

      {/* Hero image placeholder */}
      <View className="w-full aspect-[375/208] rounded-lg bg-white/5 mt-2" />

      {/* Content — mirrors the live layout order so the swap doesn't jump:
          title → host/artist box → key-facts rows → description. */}
      <Animated.View style={pulseStyle} className="gap-7 mt-3">
        {/* Title */}
        <View className="w-3/4 h-8 rounded bg-white/10" />

        {/* Host/Artist box */}
        <View className="h-24 rounded-md border border-white/10" />

        {/* Key-facts rows (date, location, price) */}
        <View className="gap-4">
          {[0, 1, 2].map((i) => (
            <View key={i} className="flex-row items-center gap-2">
              <View className="w-5 h-5 rounded bg-white/10" />
              <View className="flex-1 h-10 rounded bg-white/5" />
            </View>
          ))}
        </View>

        {/* Description */}
        <View className="gap-2">
          <View className="w-1/3 h-6 rounded bg-white/10" />
          <View className="w-full h-4 rounded bg-white/5 mt-2" />
          <View className="w-5/6 h-4 rounded bg-white/5" />
        </View>
      </Animated.View>
    </View>
  );
}
