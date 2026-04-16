import { Ionicons } from '@expo/vector-icons';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { router, useLocalSearchParams } from 'expo-router';
import { cn } from 'heroui-native';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProfileEventCard } from '@/components/ProfileEventCard';
import { SettingsBottomSheet } from '@/components/SettingsBottomSheet';
import { useAuth } from '@/contexts/auth-context';
import { useArtistProfile } from '@/hooks/use-artist-profile';
import { useFollow } from '@/hooks/use-follow';
import { MOCK_PROFILE_IMAGE } from '@/utils/mock-images';

// ─── Types ────────────────────────────────────────────────────────────────────

type ProfileTab = 'events' | 'posts';

// ─── Social Link Icons ───────────────────────────────────────────────────────

const SOCIAL_ICONS: Record<string, string> = {
  INSTAGRAM: 'logo-instagram',
  FACEBOOK: 'logo-facebook',
  TIKTOK: 'logo-tiktok',
  YOUTUBE: 'logo-youtube',
  TWITTER: 'logo-twitter',
  WEBSITE: 'globe-outline',
};

// ─── Segment Control ─────────────────────────────────────────────────────────

function SegmentControl({
  activeTab,
  onTabChange,
}: {
  activeTab: ProfileTab;
  onTabChange: (tab: ProfileTab) => void;
}) {
  const tabs: ProfileTab[] = ['events', 'posts'];
  const labels: Record<ProfileTab, string> = { events: 'Events', posts: 'Posts' };

  return (
    <View className="mx-5 flex-row rounded-[31px] overflow-hidden bg-white">
      {tabs.map((tab, index) => {
        const isActive = tab === activeTab;
        const isFirst = index === 0;
        const isLast = index === tabs.length - 1;
        return (
          <Pressable
            key={tab}
            onPress={() => onTabChange(tab)}
            className={cn(
              'flex-1 h-[46px] items-center justify-center',
              isActive && 'bg-[#C8FF2F]',
              isFirst && 'rounded-l-[31px]',
              isLast && 'rounded-r-[31px]'
            )}
          >
            <Text className="text-sm font-bold text-black font-urbanist">{labels[tab]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Profile Header ──────────────────────────────────────────────────────────

function ArtistProfileHeader({
  profile,
  onSettingsPress,
  onFollowPress,
}: {
  profile: {
    displayName: string;
    bio: string | null;
    genres: string[];
    profileImageUrl: string | null;
    followerCount: number;
    followingCount: number;
    isOwner: boolean;
    isFollowing: boolean;
    socialLinks: Record<string, string>;
  };
  onSettingsPress?: () => void;
  onFollowPress?: () => void;
}) {
  return (
    <View className="items-center pt-2 pb-4">
      {/* Avatar + followers/following row */}
      <View className="flex-row items-center justify-center gap-6 mb-3">
        <View className="items-center w-[58px]">
          <Text className="text-[17px] font-semibold text-white">{profile.followerCount}</Text>
          <Text className="text-[13px] text-white">Followers</Text>
        </View>

        <Image
          source={profile.profileImageUrl ? { uri: profile.profileImageUrl } : MOCK_PROFILE_IMAGE}
          className="w-[86px] h-[86px] rounded-full bg-surface"
        />

        <View className="items-center w-[58px]">
          <Text className="text-[17px] font-semibold text-white">{profile.followingCount}</Text>
          <Text className="text-[13px] text-white">Following</Text>
        </View>
      </View>

      {/* Name + genres */}
      <View className="items-center gap-1.5 mb-3">
        <Text className="text-xl font-bold text-white font-urbanist">{profile.displayName}</Text>
        {profile.genres.length > 0 && (
          <Text className="text-xs font-semibold text-white/80 font-urbanist">
            {profile.genres.join(' | ')}
          </Text>
        )}
      </View>

      {/* Action buttons */}
      {profile.isOwner ? (
        <View className="flex-row items-center gap-2">
          <Pressable
            className="border border-[#8D8D8D] rounded-[20px] h-9 w-[109px] items-center justify-center"
            onPress={() => router.push('/(app)/(tabs)/profile/edit')}
          >
            <Text className="text-xs font-bold text-white uppercase tracking-wider font-urbanist">
              Edit Profile
            </Text>
          </Pressable>
          <Pressable className="w-9 h-9 items-center justify-center" onPress={onSettingsPress}>
            <Ionicons name="settings-outline" size={24} color="#fff" />
          </Pressable>
        </View>
      ) : (
        <View className="flex-row items-center gap-3 px-5">
          <Pressable
            className={cn(
              'flex-1 h-9 rounded-[20px] items-center justify-center',
              profile.isFollowing ? 'bg-[#333335]' : 'bg-[#662FFF]'
            )}
            onPress={onFollowPress}
          >
            <Text className="text-xs font-bold text-white uppercase tracking-wider font-urbanist">
              {profile.isFollowing ? 'Following' : 'Follow'}
            </Text>
          </Pressable>
          <Pressable className="flex-1 h-9 rounded-[20px] items-center justify-center border border-[#8D8D8D]">
            <Text className="text-xs font-bold text-white uppercase tracking-wider font-urbanist">
              Invite
            </Text>
          </Pressable>
        </View>
      )}

      {/* Social links */}
      {Object.keys(profile.socialLinks).length > 0 && (
        <View className="flex-row items-center gap-4 mt-4">
          {Object.entries(profile.socialLinks).map(([platform, url]) => (
            <Pressable
              key={platform}
              onPress={() => Linking.openURL(url)}
              className="w-9 h-9 items-center justify-center rounded-full bg-[#333335]"
            >
              <Ionicons
                name={(SOCIAL_ICONS[platform] ?? 'link-outline') as keyof typeof Ionicons.glyphMap}
                size={18}
                color="#fff"
              />
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Events Tab ──────────────────────────────────────────────────────────────

function EventsTab({
  upcomingEvents,
  pastEvents,
}: {
  upcomingEvents: Array<{
    id: string;
    title: string;
    coverImage: string | null;
    dateStart: Date;
    dateEnd: Date | null;
    category: string;
    venueAddress: string | null;
  }>;
  pastEvents: Array<{
    id: string;
    title: string;
    coverImage: string | null;
    dateStart: Date;
    dateEnd: Date | null;
    category: string;
    venueAddress: string | null;
  }>;
}) {
  if (upcomingEvents.length === 0 && pastEvents.length === 0) {
    return (
      <View className="py-16 items-center">
        <Text className="text-base text-white/60 text-center font-urbanist">No events yet</Text>
      </View>
    );
  }

  return (
    <View className="px-5 gap-4 pb-4">
      {upcomingEvents.length > 0 && (
        <>
          <Text className="text-sm font-semibold text-white/60 font-urbanist uppercase tracking-wide mt-2">
            Upcoming
          </Text>
          {upcomingEvents.map((event) => (
            <ProfileEventCard
              key={event.id}
              id={event.id}
              title={event.title}
              coverImage={event.coverImage}
              dateStart={new Date(event.dateStart).toISOString()}
              dateEnd={event.dateEnd ? new Date(event.dateEnd).toISOString() : null}
              category={event.category}
              venueAddress={event.venueAddress}
              onPress={() => router.push(`/(app)/(tabs)/discover/event/${event.id}`)}
            />
          ))}
        </>
      )}

      {pastEvents.length > 0 && (
        <>
          <Text className="text-sm font-semibold text-white/60 font-urbanist uppercase tracking-wide mt-2">
            Past Events
          </Text>
          {pastEvents.map((event) => (
            <ProfileEventCard
              key={event.id}
              id={event.id}
              title={event.title}
              coverImage={event.coverImage}
              dateStart={new Date(event.dateStart).toISOString()}
              dateEnd={event.dateEnd ? new Date(event.dateEnd).toISOString() : null}
              category={event.category}
              venueAddress={event.venueAddress}
              status="archived"
              onPress={() => router.push(`/(app)/(tabs)/discover/event/${event.id}`)}
            />
          ))}
        </>
      )}
    </View>
  );
}

// ─── Posts Tab (placeholder) ─────────────────────────────────────────────────

function PostsTab() {
  return (
    <View className="py-16 items-center">
      <Text className="text-base text-white/60 text-center font-urbanist">Posts coming soon</Text>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function ArtistProfileScreen() {
  const { artistId } = useLocalSearchParams<{ artistId: string }>();
  const { data: profile, isLoading, error, refetch } = useArtistProfile(artistId);
  const [activeTab, setActiveTab] = useState<ProfileTab>('events');
  const settingsRef = useRef<BottomSheetModal>(null);
  const { logout } = useAuth();
  const followMutation = useFollow();
  const [optimisticFollowing, setOptimisticFollowing] = useState<boolean | null>(null);

  const isFollowing = optimisticFollowing ?? profile?.isFollowing ?? false;

  const handleFollowPress = () => {
    if (!profile) return;
    const newState = !isFollowing;
    setOptimisticFollowing(newState);
    followMutation.mutate(
      { followeeId: profile.userId, isFollowing },
      {
        onError: () => setOptimisticFollowing(null),
        onSuccess: () => setOptimisticFollowing(null),
      }
    );
  };

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
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#080808' }}>
        <View className="flex-row items-center px-4 py-3">
          <Pressable onPress={() => router.back()} className="mr-3">
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </Pressable>
        </View>
        <View className="flex-1 items-center justify-center px-6">
          <Ionicons name="person-outline" size={48} color="#8D8D8D" />
          <Text className="text-lg font-semibold text-white mt-3 font-urbanist">
            Artist not found
          </Text>
          <Text className="text-sm text-white/60 text-center mt-1 font-urbanist">
            This profile may have been removed or is no longer active.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

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
              <SegmentControl activeTab={activeTab} onTabChange={setActiveTab} />
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

            <ArtistProfileHeader
              profile={{ ...profile, isFollowing }}
              onSettingsPress={profile.isOwner ? () => settingsRef.current?.present() : undefined}
              onFollowPress={handleFollowPress}
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
