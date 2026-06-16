import { useCallback, useRef, useState } from 'react';
import type { ViewToken } from 'react-native';
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from 'react-native';

import { PostCard, type PostCardPost } from './PostCard';

type Props = {
  posts: PostCardPost[];
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  currentUserId: string | null;
  onLoadMore: () => void;
  refreshing: boolean;
  onRefresh: () => void;
  emptyMessage?: string;
};

// A card counts as "on screen" once 60% of it is visible. Below that we don't
// want to hand it the autoplay baton — half-scrolled videos shouldn't fire.
const VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 60 };

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
  hasNextPage,
  currentUserId,
  onLoadMore,
  refreshing,
  onRefresh,
  emptyMessage = 'No posts yet.',
}: Props) {
  // The post id whose video should currently autoplay. `null` = no video on screen.
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);

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
    setActiveVideoId(firstVideo ? (firstVideo.item as PostCardPost).id : null);
  }).current;

  const renderItem = useCallback(
    ({ item }: { item: PostCardPost }) => (
      <PostCard post={item} currentUserId={currentUserId} activeVideo={item.id === activeVideoId} />
    ),
    [currentUserId, activeVideoId]
  );

  if (isLoading) {
    return (
      <View className="py-12 items-center">
        <ActivityIndicator color="#C8FF2F" />
      </View>
    );
  }

  return (
    <FlatList
      data={posts}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      // Re-render rows when the active video changes so the right card flips
      // between poster and autoplay.
      extraData={activeVideoId}
      viewabilityConfig={VIEWABILITY_CONFIG}
      onViewableItemsChanged={onViewableItemsChanged}
      style={{ flex: 1, backgroundColor: '#080808' }}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 32,
        flexGrow: 1,
      }}
      onEndReached={() => {
        if (hasNextPage) onLoadMore();
      }}
      onEndReachedThreshold={0.5}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#C8FF2F" />
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
