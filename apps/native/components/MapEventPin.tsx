import { Image, Text, View } from 'react-native';

import { getMockEventImage } from '@/utils/mock-images';

type SinglePinProps = {
  type: 'single';
  coverImageUrl?: string;
  category?: string;
  categoryIcon?: string;
  isSelected?: boolean;
};

type ClusterPinProps = {
  type: 'cluster';
  count: number;
};

type MapEventPinProps = SinglePinProps | ClusterPinProps;

export function MapEventPin(props: MapEventPinProps) {
  if (props.type === 'cluster') {
    return (
      <View className="w-9 h-9 rounded-full bg-[#C8FF2F] items-center justify-center">
        <Text className="text-white text-[13px] font-bold">{props.count}</Text>
      </View>
    );
  }

  const { coverImageUrl, category, categoryIcon, isSelected } = props;

  const pinSize = isSelected ? 56 : 44;
  const pinRadius = isSelected ? 28 : 22;
  const pinStyle = { width: pinSize, height: pinSize, borderRadius: pinRadius };

  const PinContent = () => (
    <View className="border-2 border-white overflow-hidden" style={pinStyle}>
      <Image
        source={coverImageUrl ? { uri: coverImageUrl } : getMockEventImage(category ?? 'pin')}
        style={pinStyle}
        resizeMode="cover"
      />
    </View>
  );

  return (
    <View className="items-center">
      {/* Category badge above the pin */}
      {(category ?? categoryIcon) ? (
        <View className="flex-row items-center bg-[#C8FF2F] px-2 py-0.5 rounded-full mb-1 gap-[3px]">
          {categoryIcon ? <Text className="text-[10px]">{categoryIcon}</Text> : null}
          {category ? (
            <Text
              className="text-[10px] text-black font-semibold"
              style={{ fontFamily: 'Urbanist_700Bold' }}
            >
              {category}
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* Outer glow ring — only when selected */}
      {isSelected ? (
        <View
          className="w-[70px] h-[70px] rounded-[35px] border-[3px] border-[#6155F5] items-center justify-center"
          style={{ boxShadow: '0 0 8px rgba(97,85,245,0.7)' }}
        >
          <PinContent />
        </View>
      ) : (
        <PinContent />
      )}
    </View>
  );
}
