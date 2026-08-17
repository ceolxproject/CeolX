import { useCallback, useEffect, useRef, useState } from 'react';
import type { ViewToken } from 'react-native';
import { ActivityIndicator, Pressable, RefreshControl, Text, View } from 'react-native';
import Animated, { type useAnimatedScrollHandler } from 'react-native-reanimated';

import { PostCard, type PostCardPost } from './PostCard';

import { prefetchImageRatios } from '@/hooks/use-image-ratio';

type Props = {
  posts: PostCardPost[];
  isLoading: boolean;
  isFetchingNextPage: boolean;
  isError?: boolean;
  onRetry?: () => void;
  hasNextPage: boolean;
  currentUserId: string | null;
  onLoadMore: () => void;
  refreshing: boolean;
  onRefresh: () => void;
  emptyMessage?: string;
  /** Reanimated scroll handler — lets the parent collapse its header on scroll. */
  onScroll?: ReturnType<typeof useAnimatedScrollHandler>;
  /** Top padding so the feed clears the parent's absolute (collapsing) header. */
  contentPaddingTop?: number;
};

// A card counts as "on screen" once 60% of it is visible. Below that we don't
// want to hand it the autoplay baton — half-scrolled videos shouldn't fire.
//
// Do not lower this to make videos start sooner. Because `viewableItems` is
// ascending by index and the handler below takes the FIRST viewable video, a
// lower threshold keeps the *outgoing* card viewable for longer, so it holds the
// baton for longer and the next card starts later. Startup latency is solved by
// the preload window instead — see PRELOAD_AHEAD.
const VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 60 };

// How many cards either side of the active one get to buffer early. expo-video
// starts fetching the moment a player is handed a source, without waiting to be
// attached to a view, so a card that preloads has its manifest and first
// segments in hand before it ever reaches the screen — which is what actually
// removes the wait, rather than trying to make a cold start run faster.
//
// Mux's own reference feed preloads 5 ahead; that is a demo on office wifi. This
// audience is on Irish mobile data, and the feed is mixed media, so a window of
// 2 often contains fewer than 2 videos. Raise it only with a data cost in mind.
const PRELOAD_AHEAD = 2;
const PRELOAD_BEHIND = 1;

/**
 * The discover Posts feed. Unlike <PostsList> (a plain map used inside other
 * screens' ScrollViews), this is a real FlatList so we can use
 * onViewableItemsChanged to drive reels-style autoplay: exactly one video plays
 * at a time, and only while it's on screen.
 */
export function FeedPostsList({
  posts,
  isLoading,
  isFetchingNextPage,
  isError,
  onRetry,
  hasNextPage,
  currentUserId,
  onLoadMore,
  refreshing,
  onRefresh,
  emptyMessage = 'No posts yet.',
  onScroll,
  contentPaddingTop = 16,
}: Props) {
  // Which video plays, and where the user is in the list. Kept as one object so a
  // single viewability callback can't leave the two disagreeing for a frame.
  // `activeId` null = no video on screen; `anchor` null = nothing measured yet.
  const [videoWindow, setVideoWindow] = useState<{
    activeId: string | null;
    anchor: number | null;
  }>({ activeId: null, anchor: null });

  // Cards size themselves to each poster's own ratio, which needs the image's
  // natural dimensions. Measure a page of them as it arrives so the card is the
  // right height on first paint rather than resizing once the image resolves.
  useEffect(() => {
    prefetchImageRatios(
      posts.filter((post) => post.mediaType === 'image').map((post) => post.mediaUrl)
    );
  }, [posts]);

  // FlatList requires these to be stable for the lifetime of the list, so they
  // live in refs. The handler picks the active video from the items RN reports
  // as viewable.
  //
  // Active-video rule: the FIRST viewable video (topmost on screen). This is the
  // simplest reels-ish behaviour and matches how you scroll a feed top-to-bottom.
  // Alternative worth considering: the video closest to the vertical centre of
  // the viewport (feels more deliberate when two videos are partly visible). To
  // switch, sort `viewableItems` by distance of their midpoint from the screen
  // centre instead of taking the first — RN doesn't give pixel positions here,
  // so that needs onScroll + measured layouts.
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const firstVideo = viewableItems.find((token) => {
      const item = token.item as PostCardPost;
      return token.isViewable && item.mediaType === 'video';
    });
    // Anchor the preload window on the topmost visible card, video or not — it's
    // where the user actually is, and the feed is mixed media.
    const firstVisible = viewableItems.find((token) => token.isViewable);
    setVideoWindow({
      activeId: firstVideo ? (firstVideo.item as PostCardPost).id : null,
      anchor: firstVisible?.index ?? null,
    });
  }).current;

  const renderItem = useCallback(
    ({ item, index }: { item: PostCardPost; index: number }) => {
      const { activeId, anchor } = videoWindow;
      const preloadVideo =
        anchor !== null && index >= anchor - PRELOAD_BEHIND && index <= anchor + PRELOAD_AHEAD;
      return (
        <PostCard
          post={item}
          currentUserId={currentUserId}
          activeVideo={item.id === activeId}
          preloadVideo={preloadVideo}
        />
      );
    },
    [currentUserId, videoWindow]
  );

  if (isLoading) {
    return (
      <View className="items-center" style={{ paddingTop: contentPaddingTop + 48 }}>
        <ActivityIndicator color="#C8FF2F" />
      </View>
    );
  }

  if (isError) {
    return (
      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-white/60 text-center text-sm font-urbanist">
          Something went wrong loading posts.
        </Text>
        <Pressable onPress={onRetry} className="mt-4 bg-[#C8FF2F] rounded-full px-6 py-2">
          <Text className="text-black font-semibold text-sm font-urbanist">Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <Animated.FlatList
      data={posts}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      onScroll={onScroll}
      scrollEventThrottle={16}
      // Re-render rows when the active video or the preload window moves, so the
      // right cards flip between poster, buffering and autoplay.
      extraData={videoWindow}
      viewabilityConfig={VIEWABILITY_CONFIG}
      onViewableItemsChanged={onViewableItemsChanged}
      style={{ flex: 1, backgroundColor: '#080808' }}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: contentPaddingTop,
        paddingBottom: 32,
        flexGrow: 1,
      }}
      onEndReached={() => {
        if (hasNextPage) onLoadMore();
      }}
      onEndReachedThreshold={0.5}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#C8FF2F"
          progressViewOffset={contentPaddingTop}
        />
      }
      ListFooterComponent={
        isFetchingNextPage ? <ActivityIndicator color="#C8FF2F" className="my-4" /> : null
      }
      ListEmptyComponent={
        <View className="py-16 items-center px-5">
          <Text className="text-base text-white/60 text-center font-urbanist">{emptyMessage}</Text>
        </View>
      }
      showsVerticalScrollIndicator={false}
    />
  );
}
