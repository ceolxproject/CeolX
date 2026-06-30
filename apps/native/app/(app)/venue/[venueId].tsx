import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/AppHeader';
import { appToast } from '@/components/AppToast';
import { PostsList } from '@/components/posts/PostsList';
import {
  EventsTab,
  ProfileHeader,
  ProfileNotFoundState,
  SegmentControl,
} from '@/components/profiles';
import { SettingsBottomSheet } from '@/components/SettingsBottomSheet';
import { useAuth } from '@/contexts/auth-context';
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

function SubscriptionBanner({ onResendEmail }: { onResendEmail: () => void }) {
  return (
    <View className="mx-5 mb-4 p-4 rounded-xl bg-[#1C1C1E] border border-[#8D8D8D]/30">
      <Text className="text-sm font-semibold text-white font-urbanist mb-1">
        Activate Your Venue
      </Text>
      <Text className="text-xs text-white/60 font-urbanist mb-3">
        Your profile is not yet visible to artists. Check your email to activate.
      </Text>
      <Pressable
        className="bg-[#662FFF] rounded-[20px] h-9 items-center justify-center"
        onPress={onResendEmail}
      >
        <Text className="text-xs font-bold text-white uppercase tracking-wider font-urbanist">
          Resend Activation Email
        </Text>
      </Pressable>
    </View>
  );
}

export default function VenueProfileScreen() {
  const { venueId } = useLocalSearchParams<{ venueId: string }>();
  const { data: profile, isLoading, error, refetch } = useVenueProfile(venueId);
  const [activeTab, setActiveTab] = useState<ProfileTab>('events');
  const settingsRef = useRef<BottomSheetModal>(null);
  const { logout } = useAuth();
  const { data: me } = useMe();
  const { isFollowing, onFollowPress } = useProfileFollowHandler(profile);
  const { shareInterest } = useShareInterest();

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

  const showSubscriptionBanner =
    profile.isOwner && profile.subscriptionStatus && profile.subscriptionStatus !== 'active';

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
          isOwner={profile.isOwner}
          isFollowing={isFollowing}
          socialLinks={profile.socialLinks}
          contactEmail={profile.contactEmail}
          onEditPress={() => router.push('/(app)/(tabs)/profile/edit')}
          onSettingsPress={profile.isOwner ? () => settingsRef.current?.present() : undefined}
          onFollowPress={!profile.isOwner ? onFollowPress : undefined}
          onFollowersPress={() =>
            router.push({
              pathname: '/(app)/(tabs)/profile/followers',
              params: { userId: profile.userId, name: profile.displayName },
            })
          }
          onFollowingPress={() =>
            router.push({
              pathname: '/(app)/(tabs)/profile/following',
              params: { userId: profile.userId, name: profile.displayName },
            })
          }
          secondaryCta={
            !profile.isOwner && me?.currentRole === 'artist'
              ? {
                  label: 'Share Interest',
                  onPress: () => shareInterest(profile.userId),
                }
              : undefined
          }
        />

        <View className="bg-[rgba(141,141,141,0.3)] rounded-t-[20px] mt-2 pt-4 flex-1">
          {showSubscriptionBanner && (
            <SubscriptionBanner
              onResendEmail={() =>
                appToast.info(
                  'Coming Soon',
                  'Activation email resend will be available in a future update.'
                )
              }
            />
          )}
          <SegmentControl
            tabs={TABS}
            labels={TAB_LABELS}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
          <View className="mt-4 flex-1">{renderTabContent()}</View>
        </View>
      </ScrollView>

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
