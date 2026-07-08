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
import { useGuestGate } from '@/hooks/use-guest-gate';
import { useMe } from '@/hooks/use-me';
import { useProfileFollowHandler } from '@/hooks/use-profile-follow-handler';
import { useShareInterest } from '@/hooks/use-share-interest';
import { useUserPosts } from '@/hooks/use-user-posts';
import { useVenueProfile } from '@/hooks/use-venue-profile';

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

export default function VenueProfileScreen() {
  const { venueId } = useLocalSearchParams<{ venueId: string }>();
  const { data: profile, isLoading, error, refetch } = useVenueProfile(venueId);
  const [activeTab, setActiveTab] = useState<ProfileTab>('events');
  const { guard } = useGuestGate();
  const { data: me } = useMe();
  const { isFollowing, onFollowPress } = useProfileFollowHandler(profile);
  const { shareInterest } = useShareInterest();

  // Public profile screen. Owners get the richer Profile tab (Collaboration,
  // owner event actions), so redirect self-views. The param is the target user id.
  if (me?.id === venueId) {
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
    return <ProfileNotFoundState entityName="Venue" />;
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
          subtitle={profile.address}
          subtitleIcon="location-outline"
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
            me?.currentRole === 'artist'
              ? {
                  label: 'Share Interest',
                  onPress: () => shareInterest(profile.userId),
                }
              : undefined
          }
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
