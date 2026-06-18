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
  isSelf: boolean;
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
        <View className="flex-row items-center gap-2">
          <Text
            className="shrink text-[15px] font-medium text-white font-urbanist"
            numberOfLines={1}
          >
            {item.profile.displayName}
          </Text>
          <ProfileTypeTag type={item.profileType} />
        </View>
        <Text className="text-[13px] text-[#8a8a8f] font-urbanist mt-0.5">
          {item.eventsCount} events
        </Text>
      </View>
      {!isSpectator &&
        !item.isSelf &&
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
  // `userId`/`name` are passed when viewing ANOTHER profile's followers (from the
  // artist/venue screens). Absent → the viewer's own list.
  const { userId, name } = useLocalSearchParams<{ userId?: string; name?: string }>();
  const { data: me } = useMe();
  const isOwnList = !userId || userId === me?.id;

  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const followMutation = useFollow();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    ...trpc.follows.getFollowers.queryOptions({ limit: 50, offset: 0, userId }),
  });

  const filteredFollowers = useMemo(() => {
    const followers = data?.followers ?? [];
    const query = searchQuery.trim().toLowerCase();
    if (!query) return followers;
    return followers.filter((item) => item.profile?.displayName?.toLowerCase().includes(query));
  }, [data?.followers, searchQuery]);

  const handleToggle = (followeeId: string, isFollowedBack: boolean) => {
    setPendingId(followeeId);
    followMutation.mutate(
      { followeeId, isFollowing: isFollowedBack },
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
          Followers
        </Text>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          className="absolute left-1 bottom-3 size-12 items-center justify-center rounded-full"
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </Pressable>
        <Pressable onPress={toggleSearch} hitSlop={12} className="absolute right-4 bottom-[22px]">
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
          data={filteredFollowers}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
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
                {searchQuery.trim()
                  ? `No results for "${searchQuery.trim()}"`
                  : isOwnList
                    ? "You don't have any followers yet"
                    : `${name ?? 'This profile'}'s fan club starts with you`}
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
