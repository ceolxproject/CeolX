import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { PostCard, type PostCardPost } from './PostCard';

type Props = {
  posts: PostCardPost[];
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  currentUserId: string | null;
  onLoadMore: () => void;
  hideAuthorHeader?: boolean;
  emptyMessage?: string;
};

export function PostsList({
  posts,
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  currentUserId,
  onLoadMore,
  hideAuthorHeader,
  emptyMessage = 'No posts yet.',
}: Props) {
  if (isLoading) {
    return (
      <View className="py-12 items-center">
        <ActivityIndicator color="#C8FF2F" />
      </View>
    );
  }

  if (posts.length === 0) {
    return (
      <View className="py-16 items-center px-5">
        <Text className="text-base text-white/60 text-center font-urbanist">{emptyMessage}</Text>
      </View>
    );
  }

  return (
    <View className="px-5 pb-4">
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          currentUserId={currentUserId}
          hideAuthorHeader={hideAuthorHeader}
        />
      ))}
      {isFetchingNextPage && (
        <View className="py-4 items-center">
          <ActivityIndicator color="#C8FF2F" />
        </View>
      )}
      {hasNextPage && !isFetchingNextPage && (
        <Pressable onPress={onLoadMore} className="py-2 items-center">
          <Text className="text-xs text-white/40">Load more</Text>
        </Pressable>
      )}
    </View>
  );
}
