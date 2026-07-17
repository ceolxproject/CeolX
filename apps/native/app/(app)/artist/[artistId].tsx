import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/AppHeader';
import { PostsList } from '@/components/posts/PostsList';
import {
  EventsTab,
  ProfileHeader,
  ProfileNotFoundState,
  SegmentControl,
} from '@/components/profiles';
import { useArtistProfile } from '@/hooks/use-artist-profile';
import { useGuestGate } from '@/hooks/use-guest-gate';
import { useMe } from '@/hooks/use-me';
import { useProfileFollowHandler } from '@/hooks/use-profile-follow-handler';
import { useShareInterest } from '@/hooks/use-share-interest';
import { useShareProfile } from '@/hooks/use-share-profile';
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
      emptyMessage="No posts yet"
      emptySubtitle="Posts from this profile will appear here."
    />
  );
}

export default function ArtistProfileScreen() {
  const { artistId } = useLocalSearchParams<{ artistId: string }>();
  const { data: profile, isLoading, error, refetch } = useArtistProfile(artistId);
  const [activeTab, setActiveTab] = useState<ProfileTab>('events');
  const { guard } = useGuestGate();
  const { data: me } = useMe();
  const { isFollowing, onFollowPress } = useProfileFollowHandler(profile);
  const { shareInterest } = useShareInterest();
  const shareProfile = useShareProfile();

  // Public profile screen. Owners get the richer Profile tab (Collaboration,
  // owner event actions), so redirect self-views. The param is the target user id.
  if (me?.id === artistId) {
    return <Redirect href="/(app)/(tabs)/profile" />;
  }

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

  // Share is offered on this public profile only once the artist has claimed a
  // handle (a const so the truthy check narrows null away inside the closure).
  const shareUsername = profile.username;
  const onSharePress = shareUsername
    ? () => shareProfile(shareUsername, profile.displayName)
    : undefined;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#080808' }}>
      <AppHeader leading="back" showBell />
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={refetch} tintColor="#C8FF2F" />
        }
        showsVerticalScrollIndicator={false}
      >
        <ProfileHeader
          displayName={profile.displayName}
          subtitle={profile.genres.length > 0 ? profile.genres.join(' | ') : null}
          secondarySubtitle={profile.bio}
          profileImageUrl={profile.profileImageUrl}
          followerCount={profile.followerCount}
          followingCount={profile.followingCount}
          isOwner={false}
          isFollowing={isFollowing}
          socialLinks={profile.socialLinks}
          contactEmail={profile.contactEmail}
          onFollowPress={onFollowPress}
          onFollowersPress={guard(() =>
            router.push({
              pathname: '/(app)/(tabs)/profile/followers',
              params: { userId: profile.userId, name: profile.displayName },
            })
          )}
          onFollowingPress={guard(() =>
            router.push({
              pathname: '/(app)/(tabs)/profile/following',
              params: { userId: profile.userId, name: profile.displayName },
            })
          )}
          secondaryCta={
            me?.currentRole === 'venue'
              ? {
                  label: 'Share Interest',
                  onPress: () => shareInterest(profile.userId),
                }
              : undefined
          }
          onSharePress={onSharePress}
        />

        <View className="bg-[rgba(141,141,141,0.3)] rounded-t-[20px] mt-2 pt-4 flex-1">
          <SegmentControl
            tabs={TABS}
            labels={TAB_LABELS}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
          <View className="mt-4 flex-1">{renderTabContent()}</View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
