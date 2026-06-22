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

import type { BookingSummary } from '@CeolX/shared';
import { BookingStatus, UserRole } from '@CeolX/shared/enums';

import { appToast } from '@/components/AppToast';
import { ConfirmedBookingCard } from '@/components/bookings/ConfirmedBookingCard';
import { BellWithBadge } from '@/components/notifications/BellWithBadge';
import { PostsList } from '@/components/posts/PostsList';
import { ProfileEventCard } from '@/components/ProfileEventCard';
import { SegmentControl } from '@/components/profiles';
import { EmptyRequests } from '@/components/requests/EmptyRequests';
import { BOOKING_STATUS_FEEDBACK, type RequestAction } from '@/components/requests/RequestActions';
import { RequestCard } from '@/components/requests/RequestCard';
import { SettingsBottomSheet } from '@/components/SettingsBottomSheet';
import { useAuth } from '@/contexts/auth-context';
import { useArchiveEvent } from '@/hooks/use-archive-event';
import { useBookings } from '@/hooks/use-bookings';
import { useConfirmedEvents } from '@/hooks/use-confirmed-events';
import { useMe } from '@/hooks/use-me';
import { useMyEvents } from '@/hooks/use-my-events';
import { useMyPosts } from '@/hooks/use-my-posts';
import { useResendBooking } from '@/hooks/use-resend-booking';
import { useUpdateBooking } from '@/hooks/use-update-booking';
import { getBookingActionErrorBody } from '@/utils/booking-error';
import { MOCK_PROFILE_IMAGE } from '@/utils/mock-images';

// ─── Types ────────────────────────────────────────────────────────────────────

type SegmentTab = 'events' | 'posts' | 'bookings';

const SEGMENT_LABELS: Record<SegmentTab, string> = {
  events: 'Events',
  posts: 'Posts',
  bookings: 'Collaboration',
};

// ─── Profile Header ───────────────────────────────────────────────────────────

function ProfileHeader({
  me,
  currentRole,
  artistProfile,
  venueProfile,
  onBookmarkPress,
  onSettingsPress,
}: {
  me: { name: string | null; image: string | null; venueAddress: string | null };
  currentRole: string;
  artistProfile?: {
    stageName: string;
    bio: string | null;
    genres: string[] | null;
    profileImageUrl: string | null;
    followerCount: number;
    followingCount: number;
  } | null;
  venueProfile?: {
    venueName: string;
    bio: string | null;
    address: string;
    profileImageUrl: string | null;
    followerCount: number;
    followingCount: number;
  } | null;
  onBookmarkPress?: () => void;
  onSettingsPress: () => void;
}) {
  const isVenue = currentRole === UserRole.VENUE;
  const followerCount = (isVenue ? venueProfile?.followerCount : artistProfile?.followerCount) ?? 0;
  const followingCount =
    (isVenue ? venueProfile?.followingCount : artistProfile?.followingCount) ?? 0;
  const avatarUrl =
    (isVenue ? venueProfile?.profileImageUrl : artistProfile?.profileImageUrl) ?? me.image;
  const displayName = isVenue
    ? (venueProfile?.venueName ?? me.name ?? 'Your Name')
    : (artistProfile?.stageName ?? me.name ?? 'Your Name');
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
        <BellWithBadge onPress={() => router.push('/notifications')} size={24} />
      </View>

      {/* Avatar + followers/following row */}
      <View className="flex-row items-center justify-center gap-6 mb-3">
        <Pressable
          className="items-center w-[58px]"
          onPress={() => router.push('/(app)/(tabs)/profile/followers')}
        >
          <Text className="text-[17px] font-semibold text-white">{followerCount}</Text>
          <Text className="text-[13px] text-white">Followers</Text>
        </Pressable>

        <Image
          source={avatarUrl ? { uri: avatarUrl } : MOCK_PROFILE_IMAGE}
          className="w-[86px] h-[86px] rounded-full bg-surface"
        />

        <Pressable
          className="items-center w-[58px]"
          onPress={() => router.push('/(app)/(tabs)/profile/following')}
        >
          <Text className="text-[17px] font-semibold text-white">{followingCount}</Text>
          <Text className="text-[13px] text-white">Following</Text>
        </Pressable>
      </View>

      {/* Name + details */}
      <View className="items-center gap-1.5 mb-3">
        <Text className="text-xl font-bold text-white font-urbanist">{displayName}</Text>
        {isVenue && (venueProfile?.address ?? me.venueAddress) && (
          <View className="flex-row items-center gap-1">
            <Ionicons name="location-outline" size={12} color="rgba(255,255,255,0.6)" />
            <Text className="text-xs font-semibold text-white/60 font-urbanist">
              {venueProfile?.address ?? me.venueAddress}
            </Text>
          </View>
        )}
        {currentRole === UserRole.ARTIST && genres.length > 0 && (
          <Text className="text-xs font-semibold text-white/80 font-urbanist">
            {genres.join(' | ')}
          </Text>
        )}
        {currentRole === UserRole.ARTIST && artistProfile?.bio && (
          <Text className="text-xs font-semibold text-white/80 font-urbanist text-center w-[292px]">
            {artistProfile.bio}
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
          className="w-8 h-8 items-center justify-center"
          onPress={onSettingsPress}
          hitSlop={6}
        >
          <Ionicons name="settings-outline" size={24} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({
  message,
  action,
}: {
  message: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View className="py-16 items-center px-5">
      <Text className="text-base text-white/60 text-center font-urbanist mb-4">{message}</Text>
      {action && (
        <Pressable onPress={action.onPress} className="rounded-full bg-[#662FFF] px-6 py-3">
          <Text className="text-xs font-bold text-white uppercase tracking-wider font-urbanist">
            {action.label}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── My Events Tab ────────────────────────────────────────────────────────────

function MyEventsTab() {
  const { events, isLoading, loadMore, isFetchingNextPage, refresh } = useMyEvents();
  const confirmed = useConfirmedEvents();
  const archive = useArchiveEvent({ onSuccess: () => void refresh() });
  const updateBooking = useUpdateBooking();

  const handleCancelBooking = async (bookingId: string) => {
    try {
      await updateBooking.mutateAsync({ id: bookingId, status: 'cancelled' });
      await confirmed.refresh();
      appToast.success('Booking cancelled');
    } catch (err) {
      appToast.error('Could not cancel booking', getBookingActionErrorBody(err));
    }
  };

  // Wait for both queries on the very first load before deciding layout.
  if (isLoading && confirmed.isLoading) {
    return (
      <View className="py-12 items-center">
        <ActivityIndicator color="#C8FF2F" />
      </View>
    );
  }

  const hasCreated = events.length > 0;
  const hasConfirmed = confirmed.events.length > 0;

  if (!hasCreated && !hasConfirmed) {
    return (
      <EmptyState
        message="You haven't created any events yet"
        action={{
          label: 'Create Event',
          onPress: () => router.push('/(app)/events/create'),
        }}
      />
    );
  }

  return (
    <View className="px-5 gap-4 pb-4">
      {/* Created events — events this profile owns (with manage actions). */}
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
          collectionName={event.collectionName}
          status={event.status}
          joinedCount={event.joinedCount}
          ownerActions={{
            onEdit: () => router.push(`/(app)/events/edit/${event.id}`),
            onAnalytics: () => router.push(`/(app)/events/${event.id}/analytics`),
            onArchive: () => archive.mutate({ id: event.id }),
          }}
          onPress={() => router.push(`/(app)/(tabs)/profile/event/${event.id}`)}
        />
      ))}
      {isFetchingNextPage && (
        <View className="py-4 items-center">
          <ActivityIndicator color="#C8FF2F" />
        </View>
      )}
      {hasCreated && !isFetchingNextPage && (
        <Pressable onPress={loadMore} className="py-2 items-center">
          <Text className="text-xs text-white/40">Load more</Text>
        </Pressable>
      )}

      {/* Confirmed events — events this profile is booked into (ACCEPTED). */}
      {hasConfirmed && (
        <>
          <Text className="text-xs font-bold uppercase tracking-wider text-white/50 font-urbanist mt-2">
            Confirmed
          </Text>
          {confirmed.events.map((event) => (
            <ConfirmedBookingCard
              key={event.id}
              title={event.title}
              coverImage={event.coverImage}
              dateStart={event.dateStart}
              dateEnd={event.dateEnd}
              category={event.category}
              venueAddress={event.venueAddress}
              collectionName={event.collectionName}
              bookingId={event.bookingId}
              eventStatus={event.status}
              onCancel={handleCancelBooking}
              onPress={() => router.push(`/(app)/(tabs)/profile/event/${event.id}`)}
            />
          ))}
          {confirmed.isFetchingNextPage && (
            <View className="py-4 items-center">
              <ActivityIndicator color="#C8FF2F" />
            </View>
          )}
          {confirmed.hasNextPage && !confirmed.isFetchingNextPage && (
            <Pressable onPress={confirmed.loadMore} className="py-2 items-center">
              <Text className="text-xs text-white/40">Load more</Text>
            </Pressable>
          )}
        </>
      )}
    </View>
  );
}

// ─── Collaboration Tab (sent & received booking requests) ────────────────────

const COLLAB_SEGMENTS: { key: 'sent' | 'received'; label: string }[] = [
  { key: 'sent', label: 'Sent' },
  { key: 'received', label: 'Received' },
];

// Compact count chips — left-aligned, auto-width pills with a request count.
// Lighter than a full-width segment row so it reads as a filter within the
// Collaboration tab rather than competing with the top segment control.
function CollabChips({
  active,
  onChange,
  counts,
}: {
  active: 'sent' | 'received';
  onChange: (key: 'sent' | 'received') => void;
  counts: Record<'sent' | 'received', number>;
}) {
  return (
    <View className="flex-row gap-2 mb-4">
      {COLLAB_SEGMENTS.map(({ key, label }) => {
        const isActive = key === active;
        const count = counts[key];
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            hitSlop={6}
            className={cn(
              'flex-row items-center rounded-full px-4 h-9',
              isActive ? 'bg-[#C8FF2F]' : 'bg-white/10'
            )}
          >
            <Text
              className={cn(
                'text-sm font-urbanist font-bold',
                isActive ? 'text-black' : 'text-white/70'
              )}
            >
              {label}
            </Text>
            {count > 0 && (
              <Text
                className={cn(
                  'text-sm font-urbanist font-bold ml-1.5',
                  isActive ? 'text-black/50' : 'text-white/40'
                )}
              >
                {count}
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

function CollaborationTab({ currentRole }: { currentRole: string }) {
  const userRole = currentRole as 'artist' | 'venue';
  const [tab, setTab] = useState<'sent' | 'received'>('sent');

  // Load both directions so the chip counts are accurate and switching is
  // instant (no refetch on toggle).
  const sent = useBookings({ tab: 'sent' });
  const received = useBookings({ tab: 'received' });
  const active = tab === 'sent' ? sent : received;
  const counts = { sent: sent.total, received: received.total };

  const updateBooking = useUpdateBooking();
  const resendBooking = useResendBooking();
  // Track both which request and which action is in flight, so each button shows
  // its own spinner instead of replacing the whole row.
  const [pending, setPending] = useState<{ id: string; action: RequestAction } | null>(null);

  const handleUpdate = async (id: string, status: 'accepted' | 'rejected' | 'cancelled') => {
    const copy = BOOKING_STATUS_FEEDBACK[status];
    setPending({ id, action: copy.action });
    try {
      await updateBooking.mutateAsync({ id, status });
      // Refresh both directions so counts and lists stay in sync.
      await Promise.all([sent.refresh(), received.refresh()]);
      appToast.success(copy.success);
    } catch (err) {
      appToast.error(copy.error, getBookingActionErrorBody(err));
    } finally {
      setPending(null);
    }
  };

  const handleResend = async (id: string) => {
    setPending({ id, action: 'resend' });
    try {
      await resendBooking.mutateAsync({ id });
      appToast.success('Invite resent');
    } catch (err) {
      appToast.error(
        'Could not resend invite',
        err instanceof Error ? err.message : 'Please try again.'
      );
    } finally {
      setPending(null);
    }
  };

  return (
    <View className="px-5 pb-4">
      <CollabChips active={tab} onChange={setTab} counts={counts} />

      {active.isLoading ? (
        <View className="py-12 items-center">
          <ActivityIndicator color="#C8FF2F" />
        </View>
      ) : active.isError ? (
        <View className="py-12 items-center px-8">
          <Text className="text-white/60 text-center text-sm font-urbanist">
            Something went wrong loading requests.
          </Text>
          <Pressable onPress={active.refresh} className="mt-4 bg-[#C8FF2F] rounded-full px-6 py-2">
            <Text className="text-black font-semibold text-sm font-urbanist">Retry</Text>
          </Pressable>
        </View>
      ) : active.bookings.length === 0 ? (
        <EmptyRequests tab={tab} />
      ) : (
        <View className="gap-4">
          {active.bookings.map((booking: BookingSummary) => (
            <RequestCard
              key={booking.id}
              booking={booking}
              userRole={userRole}
              onAccept={() => handleUpdate(booking.id, BookingStatus.ACCEPTED)}
              onReject={() => handleUpdate(booking.id, BookingStatus.REJECTED)}
              onWithdraw={() => handleUpdate(booking.id, BookingStatus.CANCELLED)}
              onResend={() => handleResend(booking.id)}
              onCancel={() => handleUpdate(booking.id, BookingStatus.CANCELLED)}
              pendingAction={pending?.id === booking.id ? pending.action : null}
            />
          ))}
          {active.isFetchingNextPage && (
            <View className="py-4 items-center">
              <ActivityIndicator color="#C8FF2F" />
            </View>
          )}
          {active.hasNextPage && !active.isFetchingNextPage && (
            <Pressable onPress={active.loadMore} className="py-2 items-center">
              <Text className="text-xs text-white/40">Load more</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Posts Tab ────────────────────────────────────────────────────────────────

function PostsTab() {
  const { posts, isLoading, isFetchingNextPage, hasNextPage, loadMore } = useMyPosts();
  const { data: me } = useMe();
  return (
    <PostsList
      posts={posts}
      isLoading={isLoading}
      isFetchingNextPage={isFetchingNextPage}
      hasNextPage={hasNextPage}
      currentUserId={me?.id ?? null}
      onLoadMore={loadMore}
      emptyMessage="You haven't posted anything yet."
    />
  );
}

// ─── Spectator Profile ────────────────────────────────────────────────────────

function SpectatorProfile() {
  const { user, logout } = useAuth();
  const settingsRef = useRef<BottomSheetModal>(null);

  const handleLogout = async () => {
    settingsRef.current?.dismiss();
    // Navigation is handled declaratively by (app)/_layout, which redirects to
    // sign-in the moment the session clears. A second imperative router.replace
    // here raced that redirect and caused the logout shake. (Asana 1215040939202645)
    await logout();
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

      <SettingsBottomSheet
        ref={settingsRef}
        onChangePassword={() => {
          settingsRef.current?.dismiss();
          router.push('/(app)/change-password');
        }}
        onSignOut={handleLogout}
      />
    </SafeAreaView>
  );
}

// ─── Guest Profile ────────────────────────────────────────────────────────────

function GuestProfile() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#080808' }} edges={['top']}>
      <View className="p-4 border-b border-gray-10">
        <Text className="text-2xl font-bold text-white">Profile</Text>
      </View>

      <View className="flex-1 items-center justify-center px-8">
        <View className="w-20 h-20 rounded-full bg-surface items-center justify-center mb-5">
          <Ionicons name="person-outline" size={36} color="#8d8d8d" />
        </View>
        <Text className="text-lg font-semibold text-white text-center mb-2 font-urbanist">
          You're browsing as a guest
        </Text>
        <Text className="text-sm text-white/60 text-center mb-6 font-urbanist">
          Log in or create an account to follow artists, save events, and build your profile.
        </Text>
        <Pressable
          onPress={() => router.replace('/(auth)/sign-in')}
          className="rounded-full bg-[#662FFF] px-8 py-3"
        >
          <Text className="text-xs font-bold text-white uppercase tracking-wider font-urbanist">
            Log In / Sign Up
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

// ─── Main Profile Screen ──────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { isGuest } = useAuth();
  const { data: me } = useMe();

  // Guests have no session — useMe is disabled for them, so there's no profile
  // to render. Offer a path back to auth instead of a broken spectator shell.
  if (isGuest) {
    return <GuestProfile />;
  }

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
          bio: string | null;
          genres: string[] | null;
          profileImageUrl: string | null;
          followerCount: number;
          followingCount: number;
        } | null;
        venueProfile?: {
          venueName: string;
          bio: string | null;
          address: string;
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
    // See handleLogout — (app)/_layout redirects declaratively once the session
    // clears; a second imperative replace here caused the logout shake.
    await logout();
  }, [logout]);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'events':
        return <MyEventsTab />;
      case 'posts':
        return <PostsTab />;
      case 'bookings':
        return <CollaborationTab currentRole={currentRole} />;
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
          venueProfile={me?.venueProfile}
          onBookmarkPress={() => router.push('/(app)/(tabs)/profile/saved-events')}
          onSettingsPress={() => settingsRef.current?.present()}
        />
        {/* Rounded background behind segment + content */}
        <View className="bg-[rgba(141,141,141,0.3)] rounded-t-[20px] mt-2 pt-4 flex-1">
          <SegmentControl
            tabs={tabs}
            labels={SEGMENT_LABELS}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
          <View className="mt-4">{renderTabContent()}</View>
        </View>
      </ScrollView>

      <SettingsBottomSheet
        ref={settingsRef}
        onChangePassword={() => {
          settingsRef.current?.dismiss();
          router.push('/(app)/change-password');
        }}
        onSignOut={handleSignOut}
      />
    </SafeAreaView>
  );
}
