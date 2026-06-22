import { Image, Text, View } from 'react-native';

import { CategoryIcon } from '@/components/icons/CategoryIcon';
import { getMockEventImage } from '@/utils/mock-images';

type SinglePinProps = {
  type: 'single';
  coverImageUrl?: string;
  /** Display label shown beside the icon. */
  category?: string;
  /** Raw category key (from EVENT_CATEGORIES) used to resolve the vector icon. */
  categoryKey?: string;
  isSelected?: boolean;
  /**
   * Fires once the pin image has painted. The map marker uses this to stop
   * `tracksViewChanges` (native re-rasterization) so the cover image is
   * captured in the snapshot without re-rendering every frame.
   */
  onImageLoad?: () => void;
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

  const { coverImageUrl, category, categoryKey, isSelected, onImageLoad } = props;

  const pinSize = isSelected ? 56 : 44;
  const pinRadius = isSelected ? 28 : 22;
  const pinStyle = { width: pinSize, height: pinSize, borderRadius: pinRadius };

  // Clip the circle on the <Image> itself (borderRadius + border) rather than a
  // parent View with `overflow:hidden`. On Android's New Architecture the marker
  // is rasterized off-screen via react-native-maps' ViewAttacherGroup, and a
  // clipped child layer is not reliably captured in that snapshot — the image
  // paints fine in normal views (e.g. the preview card) but stays blank inside
  // the marker. Image natively clips to its own borderRadius, so this avoids the
  // separate clip layer that the off-screen snapshot drops.
  const PinContent = () => (
    <Image
      source={coverImageUrl ? { uri: coverImageUrl } : getMockEventImage(category ?? 'pin')}
      style={[pinStyle, { borderWidth: 2, borderColor: '#ffffff' }]}
      resizeMode="cover"
      onLoad={onImageLoad}
    />
  );

  return (
    <View className="items-center">
      {/* Category badge above the pin */}
      {(category ?? categoryKey) ? (
        <View className="flex-row items-center bg-[#C8FF2F] px-2 py-0.5 rounded-full mb-1 gap-[3px]">
          {categoryKey ? <CategoryIcon category={categoryKey} size={10} color="#000" /> : null}
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
