import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/AppHeader';
import { FeedPostsList } from '@/components/posts/FeedPostsList';
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
/** The rounded panel the tab content sits on — shared by both tab branches. */
const PANEL_BG = 'rgba(141,141,141,0.3)';

/**
 * Posts tab. Rendered as the screen's own scroll container (header passed in)
 * rather than inside the ScrollView the other tabs use — a FlatList nested in a
 * ScrollView never reports which rows are on screen, and that report is what
 * drives autoplay.
 */
function PostsTab({ userId, header }: { userId: string; header: React.ReactElement }) {
  const { posts, isLoading, isFetchingNextPage, hasNextPage, loadMore, refresh } =
    useUserPosts(userId);
  const { data: me } = useMe();
  return (
    <FeedPostsList
      posts={posts}
      isLoading={isLoading}
      isFetchingNextPage={isFetchingNextPage}
      hasNextPage={hasNextPage}
      currentUserId={me?.id ?? null}
      onLoadMore={loadMore}
      refreshing={false}
      onRefresh={refresh}
      hideAuthorHeader
      ListHeaderComponent={header}
      contentBackgroundColor={PANEL_BG}
      emptyMessage="No posts yet"
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

  // Share is offered on this public profile only once the artist has claimed a
  // handle (a const so the truthy check narrows null away inside the closure).
  const shareUsername = profile.username;
  const onSharePress = shareUsername
    ? () => shareProfile(shareUsername, profile.displayName)
    : undefined;

  // Shared by both branches below: the Posts tab hands this to the list as its
  // ListHeaderComponent (so the list can own the scroll and drive autoplay),
  // while the Events tab keeps the plain ScrollView.
  const header = (
    <>
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

      <View className="bg-[rgba(141,141,141,0.3)] rounded-t-[20px] mt-2 pt-4">
        <SegmentControl
          tabs={TABS}
          labels={TAB_LABELS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
        <View className="mt-4" />
      </View>
    </>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#080808' }}>
      <AppHeader leading="back" showBell />
      {activeTab === 'posts' ? (
        <PostsTab userId={profile.userId} header={header} />
      ) : (
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={refetch} tintColor="#C8FF2F" />
          }
          showsVerticalScrollIndicator={false}
        >
          {header}
          <View className="bg-[rgba(141,141,141,0.3)] flex-1">
            <EventsTab upcomingEvents={profile.upcomingEvents} pastEvents={profile.pastEvents} />
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
