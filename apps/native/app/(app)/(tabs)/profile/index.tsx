import { Ionicons } from '@expo/vector-icons';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { router } from 'expo-router';
import { cn } from 'heroui-native';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { UserRole } from '@CeolX/shared/enums';

import { ConfirmedBookingCard } from '@/components/bookings/ConfirmedBookingCard';
import { ProfileEventCard } from '@/components/ProfileEventCard';
import { SettingsBottomSheet } from '@/components/SettingsBottomSheet';
import { useAuth } from '@/contexts/auth-context';
import { useConfirmedEvents } from '@/hooks/use-confirmed-events';
import { useMe } from '@/hooks/use-me';
import { useMyEvents } from '@/hooks/use-my-events';
import { useUpdateBooking } from '@/hooks/use-update-booking';
import { MOCK_PROFILE_IMAGE } from '@/utils/mock-images';

// ─── Types ────────────────────────────────────────────────────────────────────

type SegmentTab = 'events' | 'posts' | 'bookings';

// ─── Segment Control ──────────────────────────────────────────────────────────

function SegmentControl({
  tabs,
  activeTab,
  onTabChange,
}: {
  tabs: SegmentTab[];
  activeTab: SegmentTab;
  onTabChange: (tab: SegmentTab) => void;
}) {
  const labels: Record<SegmentTab, string> = {
    events: 'Events',
    posts: 'Posts',
    bookings: 'Bookings',
  };

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

// ─── Profile Header ───────────────────────────────────────────────────────────

function ProfileHeader({
  me,
  currentRole,
  artistProfile,
  onBookmarkPress,
  onSettingsPress,
}: {
  me: { name: string | null; image: string | null; venueAddress: string | null };
  currentRole: string;
  artistProfile?: {
    stageName: string;
    genres: string[];
    profileImageUrl: string | null;
    followerCount: number;
    followingCount: number;
  } | null;
  onBookmarkPress?: () => void;
  onSettingsPress: () => void;
}) {
  const followerCount = artistProfile?.followerCount ?? 0;
  const followingCount = artistProfile?.followingCount ?? 0;
  const avatarUrl = artistProfile?.profileImageUrl ?? me.image;
  const displayName =
    currentRole === UserRole.ARTIST
      ? (artistProfile?.stageName ?? me.name ?? 'Your Name')
      : (me.name ?? 'Your Name');
  const genres = artistProfile?.genres ?? [];

  return (
    <View className="items-center pt-2 pb-4 bg-background">
      {/* Header bar with bookmark + bell for venues, just bell for artists */}
      <View className="w-full flex-row items-center justify-end px-5 mb-3 gap-4">
        {onBookmarkPress && (
          <Pressable onPress={onBookmarkPress}>
            <Ionicons name="bookmark-outline" size={23} color="#fff" />
          </Pressable>
        )}
        <Pressable onPress={() => {}}>
          <Ionicons name="notifications-outline" size={24} color="#fff" />
        </Pressable>
      </View>

      {/* Avatar + followers/following row */}
      <View className="flex-row items-center justify-center gap-6 mb-3">
        <View className="items-center w-[58px]">
          <Text className="text-[17px] font-semibold text-white">{followerCount}</Text>
          <Text className="text-[13px] text-white">Followers</Text>
        </View>

        <Image
          source={avatarUrl ? { uri: avatarUrl } : MOCK_PROFILE_IMAGE}
          className="w-[86px] h-[86px] rounded-full bg-surface"
        />

        <View className="items-center w-[58px]">
          <Text className="text-[17px] font-semibold text-white">{followingCount}</Text>
          <Text className="text-[13px] text-white">Following</Text>
        </View>
      </View>

      {/* Name + details */}
      <View className="items-center gap-1.5 mb-3">
        <Text className="text-xl font-bold text-white font-urbanist">{displayName}</Text>
        {currentRole === UserRole.VENUE && me.venueAddress && (
          <View className="flex-row items-center gap-1">
            <Ionicons name="location-outline" size={12} color="rgba(255,255,255,0.6)" />
            <Text className="text-xs font-semibold text-white/60 font-urbanist">
              {me.venueAddress}
            </Text>
          </View>
        )}
        {currentRole === UserRole.ARTIST && genres.length > 0 && (
          <Text className="text-xs font-semibold text-white/80 font-urbanist">
            {genres.join(' | ')}
          </Text>
        )}
      </View>

      {/* Edit Profile + Gear */}
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
    </View>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <View className="py-16 items-center">
      <Text className="text-base text-white/60 text-center font-urbanist">{message}</Text>
    </View>
  );
}

// ─── My Events Tab ────────────────────────────────────────────────────────────

function MyEventsTab() {
  const { events, isLoading, loadMore, isFetchingNextPage } = useMyEvents();

  if (isLoading) {
    return (
      <View className="py-12 items-center">
        <ActivityIndicator color="#C8FF2F" />
      </View>
    );
  }

  if (events.length === 0) {
    return <EmptyState message="You haven't created any events yet" />;
  }

  return (
    <View className="px-5 gap-4 pb-4">
      {events.map((event) => (
        <ProfileEventCard
          key={event.id}
          id={event.id}
          title={event.title}
          coverImage={event.coverImage}
          dateStart={event.dateStart}
          dateEnd={event.dateEnd}
          category={event.category}
          venueAddress={event.venueAddress}
          status={event.status}
          onPress={() => router.push(`/(app)/(tabs)/discover/event/${event.id}`)}
        />
      ))}
      {isFetchingNextPage && (
        <View className="py-4 items-center">
          <ActivityIndicator color="#C8FF2F" />
        </View>
      )}
      {events.length > 0 && !isFetchingNextPage && (
        <Pressable onPress={loadMore} className="py-2 items-center">
          <Text className="text-xs text-white/40">Load more</Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── Bookings Tab (confirmed events for both artist & venue) ─────────────────

function BookingsTab() {
  const { events, isLoading, loadMore, isFetchingNextPage, refresh } = useConfirmedEvents();
  const updateBooking = useUpdateBooking();

  const handleCancel = async (bookingId: string) => {
    await updateBooking.mutateAsync({ id: bookingId, status: 'cancelled' });
    await refresh();
  };

  if (isLoading) {
    return (
      <View className="py-12 items-center">
        <ActivityIndicator color="#C8FF2F" />
      </View>
    );
  }

  if (events.length === 0) {
    return <EmptyState message="No confirmed bookings yet" />;
  }

  return (
    <View className="px-5 gap-4 pb-4">
      {events.map((event) => (
        <ConfirmedBookingCard
          key={event.id}
          title={event.title}
          coverImage={event.coverImage}
          dateStart={event.dateStart}
          dateEnd={event.dateEnd}
          category={event.category}
          venueAddress={event.venueAddress}
          bookingId={event.bookingId}
          onCancel={handleCancel}
          onPress={() => router.push(`/(app)/(tabs)/discover/event/${event.id}`)}
        />
      ))}
      {isFetchingNextPage && (
        <View className="py-4 items-center">
          <ActivityIndicator color="#C8FF2F" />
        </View>
      )}
      {events.length > 0 && !isFetchingNextPage && (
        <Pressable onPress={loadMore} className="py-2 items-center">
          <Text className="text-xs text-white/40">Load more</Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── Posts Tab (placeholder) ──────────────────────────────────────────────────

function PostsTab() {
  return <EmptyState message="Posts coming soon" />;
}

// ─── Spectator Profile ────────────────────────────────────────────────────────

function SpectatorProfile() {
  const { user, logout } = useAuth();
  const settingsRef = useRef<BottomSheetModal>(null);

  const handleLogout = async () => {
    settingsRef.current?.dismiss();
    await logout();
    router.replace('/(auth)/sign-in');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#080808' }} edges={['top']}>
      <View className="p-4 border-b border-gray-10 flex-row items-center justify-between">
        <Text className="text-2xl font-bold text-white">Profile</Text>
        <Pressable onPress={() => settingsRef.current?.present()}>
          <Ionicons name="settings-outline" size={24} color="#fff" />
        </Pressable>
      </View>

      <View className="items-center py-8">
        <Image source={MOCK_PROFILE_IMAGE} className="w-20 h-20 rounded-full bg-surface mb-3" />
        <Text className="text-lg font-semibold text-white mb-2">{user?.email ?? '—'}</Text>
        <View className="rounded-full bg-surface px-3 py-1">
          <Text className="text-xs font-medium text-white capitalize">spectator</Text>
        </View>
      </View>

      <View className="mx-4 border border-gray-10 rounded-xl">
        <Pressable
          className="flex-row justify-between items-center px-4 py-3.5"
          onPress={() => router.push('/(app)/(tabs)/profile/edit')}
        >
          <Text className="text-[15px] text-white">Edit Profile</Text>
          <Text className="text-lg text-gray-10">›</Text>
        </Pressable>
      </View>

      <SettingsBottomSheet
        ref={settingsRef}
        onChangePassword={() => {
          settingsRef.current?.dismiss();
        }}
        onSignOut={handleLogout}
      />
    </SafeAreaView>
  );
}

// ─── Main Profile Screen ──────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { data: me } = useMe();

  const currentRole = me?.currentRole ?? 'spectator';

  // Spectators get a simple profile — no segment control
  if (currentRole === UserRole.SPECTATOR) {
    return <SpectatorProfile />;
  }

  return <CreatorProfile me={me} currentRole={currentRole} />;
}

function CreatorProfile({
  me,
  currentRole,
}: {
  me:
    | {
        name: string | null;
        image: string | null;
        venueAddress: string | null;
        artistProfile?: {
          stageName: string;
          genres: string[];
          profileImageUrl: string | null;
          followerCount: number;
          followingCount: number;
        } | null;
      }
    | null
    | undefined;
  currentRole: string;
}) {
  const { logout } = useAuth();
  const tabs: SegmentTab[] = ['events', 'posts', 'bookings'];
  const [activeTab, setActiveTab] = useState<SegmentTab>('events');
  const settingsRef = useRef<BottomSheetModal>(null);

  const myEvents = useMyEvents();

  const handleRefresh = useCallback(async () => {
    await myEvents.refresh();
  }, [myEvents]);

  const handleSignOut = useCallback(async () => {
    settingsRef.current?.dismiss();
    await logout();
    router.replace('/(auth)/sign-in');
  }, [logout]);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'events':
        return <MyEventsTab />;
      case 'posts':
        return <PostsTab />;
      case 'bookings':
        return <BookingsTab />;
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#080808' }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={handleRefresh} tintColor="#C8FF2F" />
        }
        showsVerticalScrollIndicator={false}
      >
        <ProfileHeader
          me={{
            name: me?.name ?? null,
            image: me?.image ?? null,
            venueAddress: me?.venueAddress ?? null,
          }}
          currentRole={currentRole}
          artistProfile={me?.artistProfile}
          onBookmarkPress={() => router.push('/(app)/(tabs)/profile/saved-events')}
          onSettingsPress={() => settingsRef.current?.present()}
        />
        {/* Rounded background behind segment + content */}
        <View className="bg-[rgba(141,141,141,0.3)] rounded-t-[20px] mt-2 pt-4 flex-1">
          <SegmentControl tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
          <View className="mt-4">{renderTabContent()}</View>
        </View>
      </ScrollView>

      <SettingsBottomSheet
        ref={settingsRef}
        onChangePassword={() => {
          settingsRef.current?.dismiss();
        }}
        onSignOut={handleSignOut}
      />
    </SafeAreaView>
  );
}
