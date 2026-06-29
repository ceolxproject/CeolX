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
        <Text className="text-black text-[13px] font-bold">{props.count}</Text>
      </View>
    );
  }

  const { coverImageUrl, category, categoryKey, onImageLoad } = props;

  const pinStyle = { width: 44, height: 44, borderRadius: 22 };

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
      // Solid fill so the circle always has painted, tappable pixels — a
      // not-yet-loaded / failed remote cover would otherwise be transparent and
      // dead to taps in the frozen iOS marker snapshot.
      style={[pinStyle, { borderWidth: 2, borderColor: '#ffffff', backgroundColor: '#2B2B2B' }]}
      resizeMode="cover"
      onLoad={onImageLoad}
    />
  );

  return (
    <View className="items-center">
      {/* Pin circle MUST be the FIRST/top child. On the New Architecture,
          react-native-maps gives a frozen custom marker a touch frame that only
          covers its top element — so the tappable circle has to sit on top and
          the category label below it as a non-interactive caption. A label ABOVE
          the circle steals every tap and leaves the circle dead (Asana
          1215961153969025). */}
      <PinContent />

      {/* Category caption below the pin (informational — not tappable). */}
      {(category ?? categoryKey) ? (
        <View className="flex-row items-center bg-[#C8FF2F] px-2 py-0.5 rounded-full mt-1 gap-[3px]">
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
    </View>
  );
}
