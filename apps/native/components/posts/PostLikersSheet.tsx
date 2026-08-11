import { Ionicons } from '@expo/vector-icons';
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetFlatList,
  BottomSheetModal,
} from '@gorhom/bottom-sheet';
import { useInfiniteQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Dimensions,
  Image,
  Pressable,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProfileTypeTag } from '@/components/profiles';
import { useLikersSheetControls, useLikersSheetPostId } from '@/hooks/use-likers-sheet';
import { trpcClient } from '@/utils/trpc';

// A page is roughly three screens of rows, so scrolling stays ahead of the fetch.
// ponytail: offset paging, matching every other list in the app. It degrades on
// very deep pages (OFFSET 50000 makes Postgres walk 50k index rows before
// returning any) — swap to a keyset cursor on (created_at, id) if a post ever
// gets likes in the tens of thousands.
const PAGE_SIZE = 30;

const SCREEN_HEIGHT = Dimensions.get('window').height;
const ROW_HEIGHT = 56; // h-14
const SEPARATOR_HEIGHT = 1;
const HEADER_HEIGHT = 68; // grab handle + "Likes / N total"
// Past this many rows the sheet stops growing and starts scrolling. Roughly the
// point where it would cover the post it belongs to.
const MAX_VISIBLE_ROWS = 8;

type Liker = {
  id: string;
  displayName: string;
  profileImageUrl: string | null;
  profileType: 'artist' | 'venue' | 'user';
};

function LikerRow({ liker, onNavigate }: { liker: Liker; onNavigate: (href: string) => void }) {
  // Spectators have no public profile, so their row is inert — same rule the
  // followers list applies.
  const handlePress = () => {
    if (liker.profileType === 'artist') {
      onNavigate(`/(app)/artist/${liker.id}`);
    } else if (liker.profileType === 'venue') {
      onNavigate(`/(app)/venue/${liker.id}`);
    }
  };

  return (
    <Pressable className="flex-row items-center h-14 active:opacity-70" onPress={handlePress}>
      {liker.profileImageUrl ? (
        <Image
          source={{ uri: liker.profileImageUrl }}
          className="w-[45px] h-[45px] rounded-full bg-surface"
        />
      ) : (
        <View className="w-[45px] h-[45px] rounded-full bg-surface items-center justify-center">
          <Ionicons name="person-outline" size={20} color="#8d8d8d" />
        </View>
      )}
      <Text
        className="flex-1 ml-3 text-[15px] font-medium text-white font-urbanist"
        numberOfLines={1}
      >
        {liker.displayName}
      </Text>
      <ProfileTypeTag type={liker.profileType === 'user' ? null : liker.profileType} />
    </Pressable>
  );
}

/**
 * Who liked a post. Mounted once at the app root — any PostCard opens it via
 * `useLikersSheetControls().open(postId)`.
 */
export function PostLikersSheet() {
  const sheetRef = useRef<BottomSheetModal>(null);
  const postId = useLikersSheetPostId();
  const { close } = useLikersSheetControls();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (postId) sheetRef.current?.present();
    else sheetRef.current?.dismiss();
  }, [postId]);

  // Android hardware back: @gorhom/bottom-sheet doesn't hook into it, so an
  // unhandled press falls through to the navigator instead of closing the sheet.
  // Same guard SettingsBottomSheet needs.
  useEffect(() => {
    if (!postId) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [postId, close]);

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['posts.likers', postId],
    enabled: Boolean(postId),
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      trpcClient.posts.likers.query({
        postId: postId as string,
        limit: PAGE_SIZE,
        offset: pageParam,
      }),
    getNextPageParam: (last, _pages, lastOffset) =>
      last.hasNextPage ? lastOffset + PAGE_SIZE : undefined,
    // useInfiniteQuery refetches EVERY loaded page when it goes stale, so with
    // the client default of 0 a refocus after scrolling 8 pages deep fires 8
    // requests at once. Who liked a post doesn't change minute to minute.
    staleTime: 60_000,
  });

  // A like landing while the sheet is open shifts every row down one, so the
  // same liker can come back on the next offset. Drop repeats or FlatList gets
  // duplicate keys — the same guard use-feed-posts applies to ranked pages.
  const likers = useMemo(() => {
    const seen = new Set<string>();
    return (data?.pages ?? []).flatMap((page) =>
      page.likers.filter((l) => !seen.has(l.id) && seen.add(l.id))
    );
  }, [data]);

  const totalCount = data?.pages[0]?.totalCount ?? 0;

  // Height comes from the like count, NOT from measuring content. Dynamic sizing
  // leaves the list with no fixed container height, so onEndReached fires on a
  // loop and pages in the whole list unprompted — the exact thing paging exists
  // to avoid. A known height also keeps the scroll offset stable as pages land.
  const snapPoints = useMemo(() => {
    const rows = Math.min(Math.max(totalCount, 1), MAX_VISIBLE_ROWS);
    const height = HEADER_HEIGHT + rows * (ROW_HEIGHT + SEPARATOR_HEIGHT) + insets.bottom + 16;
    return [Math.min(height, SCREEN_HEIGHT * 0.75)];
  }, [totalCount, insets.bottom]);

  // Dismiss before pushing: leaving the sheet mounted over a new screen traps
  // the backdrop above it. Mirrors SettingsBottomSheet's About handler.
  const handleNavigate = useCallback(
    (href: string) => {
      close();
      router.push(href as never);
    },
    [close]
  );

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.6} />
    ),
    []
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      enablePanDownToClose
      onDismiss={close}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: '#2B2B2B' }}
      handleIndicatorStyle={{ backgroundColor: '#8d8d8d' }}
    >
      <View className="flex-row items-baseline justify-between px-4 pb-2">
        <Text className="text-xl font-bold text-white font-urbanist">Likes</Text>
        {data ? (
          <Text className="text-[13px] text-[#8a8a8f] font-urbanist">{totalCount} total</Text>
        ) : null}
      </View>

      {isLoading ? (
        <View className="py-10 items-center">
          <ActivityIndicator color="#C8FF2F" />
        </View>
      ) : (
        <BottomSheetFlatList
          data={likers}
          keyExtractor={(item: Liker) => item.id}
          renderItem={({ item }: { item: Liker }) => (
            <LikerRow liker={item} onNavigate={handleNavigate} />
          )}
          ItemSeparatorComponent={() => <View className="h-px bg-gray-10/50 ml-[57px]" />}
          // Rows are a fixed height, so hand virtualization the geometry rather
          // than letting it infer one from what happens to be rendered.
          getItemLayout={(_: unknown, index: number) => ({
            length: ROW_HEIGHT + SEPARATOR_HEIGHT,
            offset: (ROW_HEIGHT + SEPARATOR_HEIGHT) * index,
            index,
          })}
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
          }}
          ListFooterComponent={
            isFetchingNextPage ? (
              <View className="py-4 items-center">
                <ActivityIndicator color="#C8FF2F" />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View className="py-10 items-center">
              <Text className="text-base text-white/60 font-urbanist">No likes yet</Text>
            </View>
          }
          // The sheet sits flush to the screen edge, so the last row needs the
          // home-indicator inset under it or it reads as clipped.
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 16 }}
        />
      )}
    </BottomSheetModal>
  );
}
