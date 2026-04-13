import { cn } from 'heroui-native';
import { View } from 'react-native';

interface EventDetailSkeletonProps {
  className?: string;
}

export function EventDetailSkeleton({ className }: EventDetailSkeletonProps) {
  return (
    <View className={cn('flex-1 bg-surface-dark px-4', className)}>
      {/* Header placeholder */}
      <View className="flex-row items-center justify-between py-3">
        <View className="w-6 h-6 rounded bg-white/10" />
        <View className="w-20 h-4 rounded bg-white/10" />
        <View className="flex-row gap-4">
          <View className="w-6 h-6 rounded bg-white/10" />
          <View className="w-6 h-6 rounded bg-white/10" />
        </View>
      </View>

      {/* Hero image placeholder */}
      <View className="w-full aspect-[335/208] rounded-lg bg-white/5 mt-2" />

      {/* Title placeholder */}
      <View className="w-3/4 h-8 rounded bg-white/10 mt-4" />

      {/* Info box placeholder */}
      <View className="h-24 rounded-md border border-white/10 mt-3" />

      {/* Price placeholder */}
      <View className="w-1/3 h-6 rounded bg-white/10 mt-6" />

      {/* Description placeholder */}
      <View className="mt-6 gap-2">
        <View className="w-1/3 h-6 rounded bg-white/10" />
        <View className="w-full h-4 rounded bg-white/5 mt-2" />
        <View className="w-5/6 h-4 rounded bg-white/5" />
      </View>

      {/* Info rows placeholder */}
      <View className="mt-6 gap-4">
        <View className="flex-row items-center gap-2">
          <View className="w-5 h-5 rounded bg-white/10" />
          <View className="flex-1 h-10 rounded bg-white/5" />
        </View>
        <View className="flex-row items-center gap-2">
          <View className="w-5 h-5 rounded bg-white/10" />
          <View className="flex-1 h-10 rounded bg-white/5" />
        </View>
      </View>
    </View>
  );
}
