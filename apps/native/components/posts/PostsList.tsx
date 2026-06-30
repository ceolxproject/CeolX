import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { PostCard, type PostCardPost } from './PostCard';

import { EmptyState } from '@/components/EmptyState';

type Props = {
  posts: PostCardPost[];
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  currentUserId: string | null;
  onLoadMore: () => void;
  hideAuthorHeader?: boolean;
  emptyMessage?: string;
  emptySubtitle?: string;
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
  emptySubtitle,
}: Props) {
  if (isLoading) {
    return (
      <View className="py-12 items-center">
        <ActivityIndicator color="#C8FF2F" />
      </View>
    );
  }

  if (posts.length === 0) {
    return <EmptyState variant="no-posts" title={emptyMessage} subtitle={emptySubtitle} />;
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
