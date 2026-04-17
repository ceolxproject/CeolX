import { Ionicons } from '@expo/vector-icons';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  EventsTab,
  ProfileHeader,
  ProfileNotFoundState,
  SegmentControl,
} from '@/components/profiles';
import { SettingsBottomSheet } from '@/components/SettingsBottomSheet';
import { useAuth } from '@/contexts/auth-context';
import { useVenueProfile } from '@/hooks/use-venue-profile';

type ProfileTab = 'events' | 'posts';

const TAB_LABELS: Record<ProfileTab, string> = { events: 'Events', posts: 'Posts' };
const TABS: ProfileTab[] = ['events', 'posts'];

function PostsTab() {
  return (
    <View className="py-16 items-center">
      <Text className="text-base text-white/60 text-center font-urbanist">Posts coming soon</Text>
    </View>
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
        return <PostsTab />;
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
              {showSubscriptionBanner && (
                <SubscriptionBanner
                  onResendEmail={() =>
                    Alert.alert(
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
              subtitle={profile.address}
              subtitleIcon="location-outline"
              secondarySubtitle={profile.bio}
              profileImageUrl={profile.profileImageUrl}
              followerCount={profile.followerCount}
              followingCount={profile.followingCount}
              isOwner={profile.isOwner}
              isFollowing={profile.isFollowing}
              socialLinks={profile.socialLinks}
              onEditPress={() => router.push('/(app)/(tabs)/profile/edit')}
              onSettingsPress={profile.isOwner ? () => settingsRef.current?.present() : undefined}
              secondaryCta={
                !profile.isOwner
                  ? {
                      label: 'Share Interest',
                      onPress: () =>
                        Alert.alert('Coming Soon', 'Share interest feature coming soon.'),
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
