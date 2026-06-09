import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';

import { PostActionMenu } from './PostActionMenu';

import { useDeletePost } from '@/hooks/use-delete-post';
import { useSharePost } from '@/hooks/use-share-post';
import { useTogglePostLike } from '@/hooks/use-toggle-post-like';
import { MOCK_PROFILE_IMAGE } from '@/utils/mock-images';

export type PostCardPost = {
  id: string;
  createdBy: string;
  caption: string;
  mediaType: string;
  mediaUrl: string | null;
  likeCount: number | null;
  author: {
    id: string;
    displayName: string;
    profileImageUrl: string | null;
    profileType: 'artist' | 'venue' | 'user';
  };
  likedByMe: boolean;
};

type Props = {
  post: PostCardPost;
  /** Current viewer's user id — drives isOwner and like state. */
  currentUserId: string | null;
  /** Hide the author header row (used on profile Posts tab). */
  hideAuthorHeader?: boolean;
  /**
   * Detail-screen mode: render the full caption (no truncation / read-more)
   * and make the card non-tappable so it can't navigate to itself.
   */
  expanded?: boolean;
};

const CAPTION_PREVIEW_LIMIT = 120;

export function PostCard({ post, currentUserId, hideAuthorHeader, expanded }: Props) {
  const isOwner = currentUserId === post.createdBy;
  // Like state is derived straight from props. useTogglePostLike patches the
  // query cache optimistically, so these values flow back through the feed /
  // detail data the instant the user taps — no local copy to drift out of sync.
  const liked = post.likedByMe;
  const likeCount = post.likeCount ?? 0;

  const toggleLike = useTogglePostLike();
  const deletePost = useDeletePost();
  const sharePost = useSharePost();

  const onLikePress = () => {
    toggleLike.mutate({ postId: post.id });
  };

  const onSharePress = () => {
    void sharePost(post.id, post.caption);
  };

  const onEdit = () => {
    router.push({ pathname: '/(app)/create/post', params: { editId: post.id } });
  };

  const onDelete = () => {
    deletePost.mutate({ id: post.id });
  };

  const openDetail = () => {
    router.push({ pathname: '/(app)/post/[postId]', params: { postId: post.id } });
  };

  // In expanded (detail) mode show the whole caption; in preview mode truncate
  // and offer a read-more affordance that opens the detail screen.
  const showReadMore = !expanded && post.caption.length > CAPTION_PREVIEW_LIMIT;
  const caption = showReadMore ? post.caption.slice(0, CAPTION_PREVIEW_LIMIT) + '…' : post.caption;

  return (
    <Pressable
      onPress={expanded ? undefined : openDetail}
      className="mb-4 rounded-2xl border border-white/10 bg-[#2a2a2a] p-4"
    >
      {/* Author header */}
      {!hideAuthorHeader && (
        <View className="mb-3 flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <Image
              source={
                post.author.profileImageUrl
                  ? { uri: post.author.profileImageUrl }
                  : MOCK_PROFILE_IMAGE
              }
              className="h-7 w-7 rounded-full bg-white/10"
            />
            <Text className="text-sm font-medium text-white font-urbanist">
              {post.author.displayName}
            </Text>
          </View>
          {isOwner && <PostActionMenu onEdit={onEdit} onDelete={onDelete} />}
        </View>
      )}

      {/* Media */}
      {post.mediaType === 'image' && post.mediaUrl && (
        <Image
          source={{ uri: post.mediaUrl }}
          className="mb-3 aspect-video w-full rounded-xl bg-white/5"
          resizeMode="cover"
        />
      )}

      {/* Actions row */}
      <View className="mb-2 flex-row items-center justify-between">
        <View className="flex-row items-center gap-4">
          <Pressable onPress={onLikePress} hitSlop={8} disabled={toggleLike.isPending}>
            <Ionicons
              name={liked ? 'heart' : 'heart-outline'}
              size={22}
              color={liked ? '#FF4D6D' : '#FFFFFF'}
            />
          </Pressable>
          <Pressable onPress={onSharePress} hitSlop={8}>
            <Ionicons name="share-outline" size={22} color="#FFFFFF" />
          </Pressable>
          {toggleLike.isPending && <ActivityIndicator size="small" color="#C8FF2F" />}
        </View>
        <Text className="text-xs tracking-wider text-[#C8C7CC] font-urbanist">
          {likeCount} {likeCount === 1 ? 'like' : 'likes'}
        </Text>
      </View>

      {/* Caption */}
      <Text className="text-sm text-white font-urbanist">
        {!hideAuthorHeader && (
          <Text className="font-bold text-white">{post.author.displayName} </Text>
        )}
        <Text className="font-light">{caption}</Text>
        {showReadMore && <Text className="font-medium text-[#6155F5]"> …read more</Text>}
      </Text>
    </Pressable>
  );
}
