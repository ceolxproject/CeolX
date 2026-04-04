import { cn } from 'heroui-native';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

type SkeletonVariant = 'card' | 'list-item' | 'profile' | 'full-screen';

interface SkeletonLoaderProps {
  variant?: SkeletonVariant;
  className?: string;
}

function ShimmerBlock({ className }: { className?: string }) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(withTiming(0.3, { duration: 700 }), withTiming(1, { duration: 700 })),
      -1,
      false
    );
  }, [opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.View style={style} className={cn('bg-gray-9 rounded-md', className)} />;
}

export function SkeletonLoader({ variant = 'card', className }: SkeletonLoaderProps) {
  if (variant === 'list-item') {
    return (
      <View className={cn('flex-row items-center gap-3 px-4 py-3', className)}>
        <ShimmerBlock className="h-10 w-10 rounded-full" />
        <View className="flex-1 gap-2">
          <ShimmerBlock className="h-4 w-3/4" />
          <ShimmerBlock className="h-3 w-1/2" />
        </View>
      </View>
    );
  }

  if (variant === 'profile') {
    return (
      <View className={cn('items-center gap-4 px-4 pt-6', className)}>
        <ShimmerBlock className="h-20 w-20 rounded-full" />
        <ShimmerBlock className="h-5 w-40" />
        <ShimmerBlock className="h-4 w-64" />
        <ShimmerBlock className="h-4 w-56" />
      </View>
    );
  }

  if (variant === 'full-screen') {
    return (
      <View className={cn('flex-1 gap-4 p-4', className)}>
        <ShimmerBlock className="h-48 w-full rounded-xl" />
        <ShimmerBlock className="h-6 w-3/4" />
        <ShimmerBlock className="h-4 w-1/2" />
        <View className="gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <View key={i} className="flex-row items-center gap-3">
              <ShimmerBlock className="h-10 w-10 rounded-full" />
              <View className="flex-1 gap-2">
                <ShimmerBlock className="h-4 w-3/4" />
                <ShimmerBlock className="h-3 w-1/2" />
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  }

  // card (default)
  return (
    <View className={cn('rounded-xl overflow-hidden gap-3 p-3', className)}>
      <ShimmerBlock className="h-36 w-full rounded-lg" />
      <ShimmerBlock className="h-5 w-3/4" />
      <ShimmerBlock className="h-4 w-1/2" />
    </View>
  );
}
