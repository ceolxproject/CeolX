import { Image, Text, View } from 'react-native';

export type OfferBlockProps = {
  adTitle: string | null | undefined;
  eventTitle: string;
  coverImage: string | null | undefined;
};

export function OfferBlock({ adTitle, eventTitle, coverImage }: OfferBlockProps) {
  if (!adTitle || adTitle.trim().length === 0) return null;

  return (
    <View className="mt-6 px-4">
      <Text className="text-xs font-bold uppercase tracking-wider text-gray-3 font-urbanist mb-2">
        Offers
      </Text>
      <View
        className="rounded-xl bg-white px-4 py-4"
        style={{ shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 8 }}
      >
        <View className="flex-row items-center gap-3">
          {coverImage ? (
            <Image source={{ uri: coverImage }} className="h-[35px] w-[35px] rounded" />
          ) : (
            <View className="h-[35px] w-[35px] rounded bg-[#d9d9d9]" />
          )}
          <View className="flex-1">
            <Text className="text-base font-medium text-black font-urbanist">
              <Text>{adTitle} on </Text>
              <Text className="font-bold">&ldquo;{eventTitle}&rdquo;</Text>
            </Text>
            <Text className="text-[11px] font-light text-black font-urbanist">{eventTitle}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
