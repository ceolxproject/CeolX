import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProfileTypeTag } from '@/components/profiles';
import { useFollow } from '@/hooks/use-follow';
import { useMe } from '@/hooks/use-me';
import { trpc } from '@/utils/trpc';

type FollowingItem = {
  id: string;
  followeeId: string;
  profileType: 'artist' | 'venue' | null;
  profile: {
    id: string;
    userId: string;
    displayName: string;
    profileImageUrl: string | null;
    genres: string[] | null;
  } | null;
  eventsCount: number;
  isFollowedByViewer: boolean;
  isSelf: boolean;
};

function FollowingRow({
  item,
  onToggle,
  isPending,
}: {
  item: FollowingItem;
  onToggle: (followeeId: string, isFollowedByViewer: boolean) => void;
  isPending: boolean;
}) {
  if (!item.profile) return null;

  const handleRowPress = () => {
    if (item.profileType === 'artist') {
      router.push(`/(app)/artist/${item.followeeId}`);
    } else if (item.profileType === 'venue') {
      router.push(`/(app)/venue/${item.followeeId}`);
    }
  };

  return (
    <Pressable className="flex-row items-center px-4 h-14" onPress={handleRowPress}>
      {item.profile.profileImageUrl ? (
        <Image
          source={{ uri: item.profile.profileImageUrl }}
          className="w-[45px] h-[45px] rounded-full bg-surface"
        />
      ) : (
        <View className="w-[45px] h-[45px] rounded-full bg-surface items-center justify-center">
          <Ionicons name="person-outline" size={20} color="#8d8d8d" />
        </View>
      )}
      <View className="flex-1 ml-3">
        <Text className="text-[15px] font-medium text-white font-urbanist" numberOfLines={1}>
          {item.profile.displayName}
        </Text>
        <Text className="text-[13px] text-[#8a8a8f] font-urbanist mt-0.5">
          {item.eventsCount} events
        </Text>
      </View>
      <View className="flex-row items-center gap-2 ml-2">
        <ProfileTypeTag type={item.profileType} />
        {/* The toggle is viewer-relative: on another profile's Following list it
            reflects whether *you* follow each person, not the profile owner. */}
        {!item.isSelf &&
          (item.isFollowedByViewer ? (
            <Pressable
              className="border border-gray-10 rounded-[20px] h-8 px-3 items-center justify-center"
              onPress={() => onToggle(item.followeeId, true)}
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
              onPress={() => onToggle(item.followeeId, false)}
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
      </View>
    </Pressable>
  );
}

function ItemDivider() {
  return <View className="h-px bg-gray-10/50 ml-[73px]" />;
}

export default function FollowingScreen() {
  // `userId`/`name` are passed when viewing ANOTHER profile's following (from the
  // artist/venue screens). Absent → the viewer's own list.
  const { userId, name } = useLocalSearchParams<{ userId?: string; name?: string }>();
  const { data: me } = useMe();
  const isOwnList = !userId || userId === me?.id;

  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const followMutation = useFollow();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    ...trpc.follows.getFollowing.queryOptions({ limit: 50, offset: 0, userId }),
  });

  const filteredFollowing = useMemo(() => {
    const following = data?.following ?? [];
    const query = searchQuery.trim().toLowerCase();
    if (!query) return following;
    return following.filter((item) => item.profile?.displayName?.toLowerCase().includes(query));
  }, [data?.following, searchQuery]);

  const handleToggle = (followeeId: string, isFollowedByViewer: boolean) => {
    setPendingId(followeeId);
    followMutation.mutate(
      { followeeId, isFollowing: isFollowedByViewer },
      { onSettled: () => setPendingId(null) }
    );
  };

  const toggleSearch = () => {
    setIsSearchOpen((open) => {
      if (open) setSearchQuery('');
      return !open;
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }} edges={['top', 'bottom']}>
      <View className="bg-black h-[96px] justify-center">
        <Text className="text-[34px] font-bold text-white font-urbanist text-center leading-[41px]">
          Following
        </Text>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          className="absolute left-1 bottom-3 size-12 items-center justify-center rounded-full"
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </Pressable>
        <Pressable
          onPress={toggleSearch}
          hitSlop={12}
          className="absolute right-1 bottom-3 size-12 items-center justify-center rounded-full"
        >
          <Ionicons name={isSearchOpen ? 'close' : 'search'} size={22} color="#fff" />
        </Pressable>
      </View>

      {isSearchOpen && (
        <View className="px-4 pb-3">
          <View className="flex-row items-center bg-surface rounded-[12px] h-11 px-3">
            <Ionicons name="search" size={18} color="#8a8a8f" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search by name"
              placeholderTextColor="#8a8a8f"
              autoFocus
              autoCorrect={false}
              className="flex-1 ml-2 text-[15px] text-white font-urbanist"
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color="#8a8a8f" />
              </Pressable>
            )}
          </View>
        </View>
      )}

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#C8FF2F" size="large" />
        </View>
      ) : (
        <FlatList
          data={filteredFollowing}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <FollowingRow
              item={item}
              onToggle={handleToggle}
              isPending={pendingId === item.followeeId}
            />
          )}
          ItemSeparatorComponent={ItemDivider}
          ListEmptyComponent={
            <View className="py-16 items-center">
              <Text className="text-base text-white/60 text-center font-urbanist">
                {searchQuery.trim()
                  ? `No results for "${searchQuery.trim()}"`
                  : isOwnList
                    ? "You're not following anyone yet"
                    : `${name ?? 'This profile'} hasn't found their crowd yet`}
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
