import { Image, Pressable, Text, View } from 'react-native';

import { AdHeadline } from './AdHeadline';

export type AdCardProps = {
  id: string;
  adTitle: string | null;
  adDescription: string | null;
  eventTitle: string;
  coverImage: string | null;
  onDismiss: (id: string) => void;
  onPress: (id: string) => void;
};

export function AdCard({
  id,
  adTitle,
  adDescription,
  eventTitle,
  coverImage,
  onDismiss,
  onPress,
}: AdCardProps) {
  return (
    <View
      className="mx-5 rounded-xl bg-white px-4 py-4"
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
            <Text className="text-[11px] font-light text-black font-urbanist">{adDescription}</Text>
          ) : null}
        </View>
      </View>

      <View className="mt-4 flex-row gap-3">
        <Pressable
          accessibilityLabel="Dismiss ad"
          onPress={() => onDismiss(id)}
          className="flex-1 items-center justify-center rounded-full border border-black py-3"
        >
          <Text className="text-xs font-bold uppercase tracking-[2px] text-black font-urbanist">
            DISMISS
          </Text>
        </Pressable>
        <Pressable
          accessibilityLabel="View ad details"
          onPress={() => onPress(id)}
          className="flex-1 items-center justify-center rounded-full bg-[#6155F5] py-3"
        >
          <Text className="text-xs font-bold uppercase tracking-[2px] text-white font-urbanist">
            VIEW DETAILS
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
