import { Pressable, Text, View } from 'react-native';

type LocationBannerProps = {
  onDismiss: () => void;
};

export function LocationBanner({ onDismiss }: LocationBannerProps) {
  return (
    <View className="absolute top-[145px] self-center z-10 flex-row items-center bg-[rgba(43,43,43,0.92)] px-4 py-2 rounded-full max-w-[320px]">
      <Text className="text-white text-[13px] flex-1">
        Using approximate location — search to refine.
      </Text>
      <Pressable onPress={onDismiss} hitSlop={8} className="ml-2">
        <Text className="text-white/60 text-[16px] font-bold">×</Text>
      </Pressable>
    </View>
  );
}
