import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { cn } from 'heroui-native';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProfileEventCard } from '@/components/ProfileEventCard';
import { useAuth } from '@/contexts/auth-context';
import { useConfirmedEvents } from '@/hooks/use-confirmed-events';
import { useMyEvents } from '@/hooks/use-my-events';
import { trpc } from '@/utils/trpc';

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
  onBookmarkPress,
}: {
  me: { name: string | null; image: string | null; venueAddress: string | null };
  currentRole: string;
  onBookmarkPress?: () => void;
}) {
  return (
    <View className="items-center pt-2 pb-4">
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
          <Text className="text-[17px] font-semibold text-white">837</Text>
          <Text className="text-[13px] text-white">Followers</Text>
        </View>

        {me.image ? (
          <Image source={{ uri: me.image }} className="w-[86px] h-[86px] rounded-full bg-surface" />
        ) : (
          <View className="w-[86px] h-[86px] rounded-full bg-surface items-center justify-center">
            <Ionicons name="person" size={36} color="#8D8D8D" />
          </View>
        )}

        <View className="items-center w-[58px]">
          <Text className="text-[17px] font-semibold text-white">92</Text>
          <Text className="text-[13px] text-white">Following</Text>
        </View>
      </View>

      {/* Name + details */}
      <View className="items-center gap-1.5 mb-3">
        <Text className="text-xl font-bold text-white font-urbanist">{me.name ?? 'Your Name'}</Text>
        {currentRole === 'venue' && me.venueAddress && (
          <View className="flex-row items-center gap-1">
            <Ionicons name="location-outline" size={12} color="rgba(255,255,255,0.6)" />
            <Text className="text-xs font-semibold text-white/60 font-urbanist">
              {me.venueAddress}
            </Text>
          </View>
        )}
        {currentRole === 'artist' && (
          <Text className="text-xs font-semibold text-white/80 font-urbanist">
            Music | Concert | Singing
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
        <Pressable
          className="w-9 h-9 items-center justify-center"
          onPress={() => router.push('/(app)/(tabs)/profile/switch-account')}
        >
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
  const { events, isLoading, loadMore, isFetchingNextPage } = useConfirmedEvents();

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

// ─── Posts Tab (placeholder) ──────────────────────────────────────────────────

function PostsTab() {
  return <EmptyState message="Posts coming soon" />;
}

// ─── Spectator Profile ────────────────────────────────────────────────────────

function SpectatorProfile() {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/sign-in');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#080808' }}>
      <View className="p-4 border-b border-gray-10">
        <Text className="text-2xl font-bold text-white">Profile</Text>
      </View>

      <View className="items-center py-8">
        <View className="w-20 h-20 rounded-full bg-surface mb-3 items-center justify-center">
          <Ionicons name="person" size={32} color="#8D8D8D" />
        </View>
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

        <View className="h-px bg-gray-10" />

        <Pressable
          className="flex-row justify-between items-center px-4 py-3.5"
          onPress={() => router.push('/(app)/(tabs)/profile/switch-account')}
        >
          <Text className="text-[15px] text-white">Switch Account Type</Text>
          <Text className="text-lg text-gray-10">›</Text>
        </Pressable>

        <View className="h-px bg-gray-10" />

        <Pressable
          className="flex-row justify-between items-center px-4 py-3.5"
          onPress={handleLogout}
        >
          <Text className="text-[15px] text-red-500">Logout</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

// ─── Main Profile Screen ──────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { data: me } = useQuery(trpc.users.me.queryOptions());

  const currentRole = me?.currentRole ?? 'spectator';

  // Spectators get a simple profile — no segment control
  if (currentRole === 'spectator') {
    return <SpectatorProfile />;
  }

  return <CreatorProfile me={me} currentRole={currentRole} />;
}

function CreatorProfile({
  me,
  currentRole,
}: {
  me: { name: string | null; image: string | null; venueAddress: string | null } | null | undefined;
  currentRole: string;
}) {
  const tabs: SegmentTab[] = ['events', 'posts', 'bookings'];
  const [activeTab, setActiveTab] = useState<SegmentTab>('events');

  const myEvents = useMyEvents();

  const handleRefresh = useCallback(async () => {
    await myEvents.refresh();
  }, [myEvents]);

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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#080808' }}>
      <FlatList
        data={[1]} // Single item — content rendered in renderItem
        keyExtractor={() => 'profile-content'}
        renderItem={() => (
          <View>
            {/* Rounded background behind segment + content */}
            <View className="bg-[rgba(141,141,141,0.3)] rounded-t-[20px] mt-2 pt-4 min-h-[300px]">
              <SegmentControl tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
              <View className="mt-4">{renderTabContent()}</View>
            </View>
          </View>
        )}
        ListHeaderComponent={
          <ProfileHeader
            me={{
              name: me?.name ?? null,
              image: me?.image ?? null,
              venueAddress: me?.venueAddress ?? null,
            }}
            currentRole={currentRole}
            onBookmarkPress={() => router.push('/(app)/(tabs)/profile/saved-events')}
          />
        }
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={handleRefresh} tintColor="#C8FF2F" />
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}
