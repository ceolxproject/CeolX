import { cn } from 'heroui-native';
import { Image, Pressable, Text, View, type PressableProps } from 'react-native';

import { SkeletonLoader } from './SkeletonLoader';

interface EventCardProps extends Omit<PressableProps, 'style'> {
  title: string;
  date: string;
  venueName: string;
  category: string;
  coverImageUri?: string;
  className?: string;
}

interface EventCardSkeletonProps {
  className?: string;
}

export function EventCard({
  title,
  date,
  venueName,
  category,
  coverImageUri,
  className,
  ...props
}: EventCardProps) {
  return (
    <Pressable
      className={cn('rounded-xl overflow-hidden bg-card active:opacity-90', className)}
      {...props}
    >
      {coverImageUri ? (
        <Image
          source={{ uri: coverImageUri }}
          className="h-36 w-full bg-muted"
          resizeMode="cover"
        />
      ) : (
        <View className="h-36 w-full bg-blue-2 items-center justify-center">
          <Text className="text-3xl">🎵</Text>
        </View>
      )}
      <View className="p-3 gap-1">
        <View className="flex-row items-center justify-between">
          <Text className="text-xs font-medium text-green-10">{category}</Text>
        </View>
        <Text className="text-sm font-semibold text-white" numberOfLines={2}>
          {title}
        </Text>
        <Text className="text-xs text-gray-7">{date}</Text>
        <Text className="text-xs text-gray-9" numberOfLines={1}>
          {venueName}
        </Text>
      </View>
    </Pressable>
  );
}

export function EventCardSkeleton({ className }: EventCardSkeletonProps) {
  return <SkeletonLoader variant="card" className={className} />;
}
