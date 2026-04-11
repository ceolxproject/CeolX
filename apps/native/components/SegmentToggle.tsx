import { cn } from 'heroui-native';
import { Pressable, Text, View } from 'react-native';

interface SegmentToggleProps {
  segments: string[];
  activeIndex: number;
  onPress: (index: number) => void;
  className?: string;
}

export function SegmentToggle({ segments, activeIndex, onPress, className }: SegmentToggleProps) {
  return (
    <View className={cn('flex-row rounded-full bg-white overflow-hidden h-[46px]', className)}>
      {segments.map((label, index) => {
        const isActive = index === activeIndex;
        return (
          <Pressable
            key={label}
            onPress={() => onPress(index)}
            className={cn(
              'flex-1 items-center justify-center',
              isActive && index === 0 && 'bg-[#C8FF2F] rounded-l-full',
              isActive && index === 1 && 'bg-[#C8FF2F] rounded-r-full',
              isActive && index > 0 && index < segments.length - 1 && 'bg-[#C8FF2F]'
            )}
          >
            <Text
              className={cn(
                'text-sm font-bold font-urbanist',
                isActive ? 'text-black' : 'text-black/60'
              )}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
