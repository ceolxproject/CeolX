import { Text, View } from 'react-native';

export type OfferBlockProps = {
  title: string | null | undefined;
  description: string | null | undefined;
};

export function OfferBlock({ title, description }: OfferBlockProps) {
  if (!title || title.trim().length === 0) return null;

  return (
    <View className="mt-6 px-4">
      <Text className="text-xs font-bold uppercase tracking-wider text-gray-3 font-urbanist mb-2">
        Offers
      </Text>
      <View className="rounded-xl bg-white px-4 py-4">
        <Text className="text-base font-semibold text-black font-urbanist">{title}</Text>
        {description ? (
          <Text className="mt-1 text-sm text-black/70 font-urbanist">{description}</Text>
        ) : null}
      </View>
    </View>
  );
}
