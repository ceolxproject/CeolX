import { cn } from 'heroui-native';
import { Pressable, Text, View } from 'react-native';

type SegmentControlProps<T extends string> = {
  tabs: T[];
  labels: Record<T, string>;
  activeTab: T;
  onTabChange: (tab: T) => void;
};

export function SegmentControl<T extends string>({
  tabs,
  labels,
  activeTab,
  onTabChange,
}: SegmentControlProps<T>) {
  return (
    <View className="mx-5 flex-row rounded-[31px] overflow-hidden bg-white">
      {tabs.map((tab, index) => {
        const isActive = tab === activeTab;
        const isFirst = index === 0;
        const isLast = index === tabs.length - 1;
        return (
          <Pressable
            key={tab}
            onPress={() => onTabChange(tab)}
            className={cn(
              'flex-1 h-[46px] items-center justify-center',
              isActive && 'bg-[#C8FF2F]',
              isFirst && 'rounded-l-[31px]',
              isLast && 'rounded-r-[31px]'
            )}
          >
            <Text className="text-sm font-bold text-black font-urbanist">{labels[tab]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
