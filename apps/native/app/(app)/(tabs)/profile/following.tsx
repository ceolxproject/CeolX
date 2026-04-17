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

// ─── Filter Tabs ─────────────────────────────────────────────────────────────

type FilterTab = 'all' | 'artist' | 'venue';

function FilterTabs({
  activeTab,
  onTabChange,
}: {
  activeTab: FilterTab;
  onTabChange: (tab: FilterTab) => void;
}) {
  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'artist', label: 'Artists' },
    { key: 'venue', label: 'Venues' },
  ];

  return (
    <View className="flex-row gap-2 px-5 py-3">
      {tabs.map(({ key, label }) => (
        <Pressable
          key={key}
          onPress={() => onTabChange(key)}
          className={`px-4 py-2 rounded-full ${
            activeTab === key ? 'bg-[#662FFF]' : 'bg-[#333335]'
          }`}
        >
          <Text className="text-xs font-bold text-white uppercase font-urbanist">{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

// ─── Following Item Row ──────────────────────────────────────────────────────

type FollowingItem = {
  id: string;
  followeeId: string;
  profileType: string | null;
  profile: {
    id: string;
    userId: string;
    displayName: string;
    profileImageUrl: string | null;
    genres: string[] | null;
  } | null;
};

function FollowingRow({
  item,
  onUnfollow,
  isUnfollowing,
}: {
  item: FollowingItem;
  onUnfollow: (followeeId: string) => void;
  isUnfollowing: boolean;
}) {
  if (!item.profile) return null;

  return (
    <Pressable
      className="flex-row items-center px-5 py-3 gap-3"
      onPress={() => {
        if (item.profileType === 'artist') {
          router.push(`/(app)/artist/${item.followeeId}`);
        } else if (item.profileType === 'venue') {
          router.push(`/(app)/venue/${item.followeeId}`);
        }
      }}
    >
      <Image
        source={
          item.profile.profileImageUrl ? { uri: item.profile.profileImageUrl } : MOCK_PROFILE_IMAGE
        }
        className="w-10 h-10 rounded-full bg-surface"
      />
      <View className="flex-1">
        <Text className="text-sm font-semibold text-white font-urbanist">
          {item.profile.displayName}
        </Text>
        {item.profileType && (
          <Text className="text-xs text-white/60 font-urbanist capitalize">{item.profileType}</Text>
        )}
      </View>
      <Pressable
        className="bg-[#333335] rounded-[20px] h-8 px-4 items-center justify-center"
        onPress={() => onUnfollow(item.followeeId)}
        disabled={isUnfollowing}
      >
        {isUnfollowing ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text className="text-xs font-bold text-white uppercase font-urbanist">Following</Text>
        )}
      </Pressable>
    </Pressable>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function FollowingScreen() {
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [unfollowingId, setUnfollowingId] = useState<string | null>(null);
  const followMutation = useFollow();

  const profileType = filterTab === 'all' ? undefined : filterTab;

  const { data, isLoading, refetch } = useQuery({
    ...trpc.follows.getFollowing.queryOptions({
      limit: 50,
      offset: 0,
      profileType,
    }),
  });

  const handleUnfollow = (followeeId: string) => {
    setUnfollowingId(followeeId);
    followMutation.mutate(
      { followeeId, isFollowing: true },
      {
        onSettled: () => setUnfollowingId(null),
      }
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#080808' }} edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3">
        <Pressable onPress={() => router.back()} className="mr-3">
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </Pressable>
        <Text className="text-lg font-bold text-white font-urbanist">Following</Text>
      </View>

      <FilterTabs activeTab={filterTab} onTabChange={setFilterTab} />

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#C8FF2F" size="large" />
        </View>
      ) : (
        <FlatList
          data={data?.following ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <FollowingRow
              item={item}
              onUnfollow={handleUnfollow}
              isUnfollowing={unfollowingId === item.followeeId}
            />
          )}
          ListEmptyComponent={
            <View className="py-16 items-center">
              <Text className="text-base text-white/60 text-center font-urbanist">
                You&apos;re not following anyone yet
              </Text>
            </View>
          }
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={refetch} tintColor="#C8FF2F" />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}
