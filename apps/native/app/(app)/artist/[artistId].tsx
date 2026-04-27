import { Ionicons } from '@expo/vector-icons';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PostsList } from '@/components/posts/PostsList';
import {
  EventsTab,
  ProfileHeader,
  ProfileNotFoundState,
  SegmentControl,
} from '@/components/profiles';
import { SettingsBottomSheet } from '@/components/SettingsBottomSheet';
import { useAuth } from '@/contexts/auth-context';
import { useArtistProfile } from '@/hooks/use-artist-profile';
import { useMe } from '@/hooks/use-me';
import { useProfileFollowHandler } from '@/hooks/use-profile-follow-handler';
import { useUserPosts } from '@/hooks/use-user-posts';

type ProfileTab = 'events' | 'posts';

const TAB_LABELS: Record<ProfileTab, string> = { events: 'Events', posts: 'Posts' };
const TABS: ProfileTab[] = ['events', 'posts'];

function PostsTab({ userId }: { userId: string }) {
  const { posts, isLoading, isFetchingNextPage, hasNextPage, loadMore } = useUserPosts(userId);
  const { data: me } = useMe();
  return (
    <PostsList
      posts={posts}
      isLoading={isLoading}
      isFetchingNextPage={isFetchingNextPage}
      hasNextPage={hasNextPage}
      currentUserId={me?.id ?? null}
      onLoadMore={loadMore}
      hideAuthorHeader
      emptyMessage="No posts yet."
    />
  );
}

export default function ArtistProfileScreen() {
  const { artistId } = useLocalSearchParams<{ artistId: string }>();
  const { data: profile, isLoading, error, refetch } = useArtistProfile(artistId);
  const [activeTab, setActiveTab] = useState<ProfileTab>('events');
  const settingsRef = useRef<BottomSheetModal>(null);
  const { logout } = useAuth();
  const { isFollowing, onFollowPress } = useProfileFollowHandler(profile);

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#080808' }}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#C8FF2F" size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !profile) {
    return <ProfileNotFoundState entityName="Artist" />;
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'events':
        return (
          <EventsTab upcomingEvents={profile.upcomingEvents} pastEvents={profile.pastEvents} />
        );
      case 'posts':
        return <PostsTab userId={profile.userId} />;
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#080808' }}>
      <FlatList
        data={[1]}
        keyExtractor={() => 'profile-content'}
        renderItem={() => (
          <View>
            <View className="bg-[rgba(141,141,141,0.3)] rounded-t-[20px] mt-2 pt-4 min-h-[300px]">
              <SegmentControl
                tabs={TABS}
                labels={TAB_LABELS}
                activeTab={activeTab}
                onTabChange={setActiveTab}
              />
              <View className="mt-4">{renderTabContent()}</View>
            </View>
          </View>
        )}
        ListHeaderComponent={
          <>
            {/* Header bar */}
            <View className="flex-row items-center justify-between px-4 py-3">
              <Pressable onPress={() => router.back()}>
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </Pressable>
              <View className="flex-row items-center gap-4">
                <Pressable>
                  <Ionicons name="bookmark-outline" size={23} color="#fff" />
                </Pressable>
                <Pressable>
                  <Ionicons name="notifications-outline" size={24} color="#fff" />
                </Pressable>
              </View>
            </View>

            <ProfileHeader
              displayName={profile.displayName}
              subtitle={profile.genres.length > 0 ? profile.genres.join(' | ') : null}
              profileImageUrl={profile.profileImageUrl}
              followerCount={profile.followerCount}
              followingCount={profile.followingCount}
              isOwner={profile.isOwner}
              isFollowing={isFollowing}
              socialLinks={profile.socialLinks}
              onEditPress={() => router.push('/(app)/(tabs)/profile/edit')}
              onSettingsPress={profile.isOwner ? () => settingsRef.current?.present() : undefined}
              onFollowPress={!profile.isOwner ? onFollowPress : undefined}
              onFollowersPress={() => router.push('/(app)/(tabs)/profile/following')}
              onFollowingPress={() => router.push('/(app)/(tabs)/profile/following')}
              secondaryCta={
                !profile.isOwner
                  ? {
                      label: 'Invite',
                      onPress: () => Alert.alert('Coming Soon', 'Invite feature coming soon.'),
                    }
                  : undefined
              }
            />
          </>
        }
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={refetch} tintColor="#C8FF2F" />
        }
        showsVerticalScrollIndicator={false}
      />

      {profile.isOwner && (
        <SettingsBottomSheet
          ref={settingsRef}
          onChangePassword={() => {
            settingsRef.current?.dismiss();
          }}
          onSignOut={async () => {
            settingsRef.current?.dismiss();
            await logout();
            router.replace('/(auth)/sign-in');
          }}
        />
      )}
    </SafeAreaView>
  );
}
