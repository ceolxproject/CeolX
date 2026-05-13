import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useFollow } from '@/hooks/use-follow';
import { MOCK_PROFILE_IMAGE } from '@/utils/mock-images';
import { trpc } from '@/utils/trpc';

type FollowerItem = {
  id: string;
  followerId: string;
  profileType: 'artist' | 'venue' | null;
  profile: {
    displayName: string;
    profileImageUrl: string | null;
    genres: string[] | null;
  };
  eventsCount: number;
  isFollowedBack: boolean;
};

function FollowerRow({
  item,
  onToggle,
  isPending,
}: {
  item: FollowerItem;
  onToggle: (followeeId: string, isFollowedBack: boolean) => void;
  isPending: boolean;
}) {
  const isSpectator = item.profileType === null;

  const handleRowPress = () => {
    if (item.profileType === 'artist') {
      router.push(`/(app)/artist/${item.followerId}`);
    } else if (item.profileType === 'venue') {
      router.push(`/(app)/venue/${item.followerId}`);
    }
  };

  return (
    <Pressable className="flex-row items-center px-4 h-14" onPress={handleRowPress}>
      <Image
        source={
          item.profile.profileImageUrl ? { uri: item.profile.profileImageUrl } : MOCK_PROFILE_IMAGE
        }
        className="w-[45px] h-[45px] rounded-full bg-surface"
      />
      <View className="flex-1 ml-3">
        <Text className="text-[15px] font-medium text-white font-urbanist" numberOfLines={1}>
          {item.profile.displayName}
        </Text>
        <Text className="text-[13px] text-[#8a8a8f] font-urbanist mt-0.5">
          {item.eventsCount} events
        </Text>
      </View>
      {!isSpectator &&
        (item.isFollowedBack ? (
          <Pressable
            className="border border-gray-10 rounded-[20px] h-8 px-3 items-center justify-center"
            onPress={() => onToggle(item.followerId, true)}
            disabled={isPending}
          >
            {isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text className="text-[12px] font-bold text-white uppercase tracking-[0.24px] font-urbanist">
                Following
              </Text>
            )}
          </Pressable>
        ) : (
          <Pressable
            className="bg-blue-10 rounded-[20px] h-8 px-4 items-center justify-center"
            onPress={() => onToggle(item.followerId, false)}
            disabled={isPending}
          >
            {isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text className="text-[12px] font-bold text-white uppercase tracking-[0.24px] font-urbanist">
                Follow
              </Text>
            )}
          </Pressable>
        ))}
    </Pressable>
  );
}

function ItemDivider() {
  return <View className="h-px bg-gray-10/50 ml-[73px]" />;
}

export default function FollowersScreen() {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const followMutation = useFollow();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    ...trpc.follows.getFollowers.queryOptions({ limit: 50, offset: 0 }),
  });

  const handleToggle = (followeeId: string, isFollowedBack: boolean) => {
    setPendingId(followeeId);
    followMutation.mutate(
      { followeeId, isFollowing: isFollowedBack },
      { onSettled: () => setPendingId(null) }
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }} edges={['top', 'bottom']}>
      <View className="bg-black h-[96px] justify-center">
        <Text className="text-[34px] font-bold text-white font-urbanist text-center leading-[41px]">
          Followers
        </Text>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          className="absolute left-1 bottom-3 size-12 items-center justify-center rounded-full"
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </Pressable>
        <Pressable hitSlop={12} className="absolute right-4 bottom-[22px]">
          <Ionicons name="search" size={22} color="#fff" />
        </Pressable>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#C8FF2F" size="large" />
        </View>
      ) : (
        <FlatList
          data={data?.followers ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <FollowerRow
              item={item}
              onToggle={handleToggle}
              isPending={pendingId === item.followerId}
            />
          )}
          ItemSeparatorComponent={ItemDivider}
          ListEmptyComponent={
            <View className="py-16 items-center">
              <Text className="text-base text-white/60 text-center font-urbanist">
                You don&apos;t have any followers yet
              </Text>
            </View>
          }
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#C8FF2F" />
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 8 }}
        />
      )}
    </SafeAreaView>
  );
}
