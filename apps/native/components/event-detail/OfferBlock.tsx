import { Image, Text, View } from 'react-native';

import { AdHeadline } from '@/components/ads/AdHeadline';

export type OfferBlockProps = {
  adTitle: string | null | undefined;
  adDescription: string | null | undefined;
  eventTitle: string;
  coverImage: string | null | undefined;
};

export function OfferBlock({ adTitle, adDescription, eventTitle, coverImage }: OfferBlockProps) {
  // Ad Title and Ad Description are each independently optional — show the
  // offer whenever either one carries content. (Matches the feed-ads server filter.)
  const hasAd = !!adTitle?.trim() || !!adDescription?.trim();
  if (!hasAd) return null;

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
            <AdHeadline adTitle={adTitle} eventTitle={eventTitle} />
            {adDescription?.trim() ? (
              <Text className="text-[11px] font-light text-black font-urbanist">
                {adDescription}
              </Text>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}
