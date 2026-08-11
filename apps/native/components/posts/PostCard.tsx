import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useSegments, type Href } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Image, Platform, Pressable, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { formatPostTimestamp } from '@CeolX/shared';

import { PostActionMenu } from './PostActionMenu';
import { PostImage } from './PostImage';
import { PostVideo } from './PostVideo';

import { useDeletePost } from '@/hooks/use-delete-post';
import { useLikeHandler } from '@/hooks/use-like-handler';
import { useLikersSheetControls } from '@/hooks/use-likers-sheet';
import { useProfileFollowHandler } from '@/hooks/use-profile-follow-handler';
import { useSharePost } from '@/hooks/use-share-post';
import { splitCaptionLinks } from '@/utils/linkify';

export type PostCardPost = {
  id: string;
  createdBy: string;
  createdAt: string | Date;
  caption: string;
  mediaType: string;
  mediaUrl: string | null;
  /** Set when this post promotes an event — drives tap-to-event + hides owner edit/delete. */
  eventId?: string | null;
  // Owner-only: set when this promo's event has already ended, driving the
  // "Ended" badge on the creator's own profile. Absent on feed/other surfaces.
  eventEnded?: boolean;
  // Mux video fields — populated only for mediaType === 'video'. Drive the
  // processing / error / ready states in <PostVideo>.
  muxStatus?: string | null;
  muxPlaybackId?: string | null;
  likeCount: number | null;
  author: {
    id: string;
    displayName: string;
    profileImageUrl: string | null;
    profileType: 'artist' | 'venue' | 'user';
    /** Whether the viewer follows this author — drives the header Follow CTA. */
    isFollowedByMe: boolean;
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
  /**
   * Called after the post is successfully deleted. Lists self-heal via the
   * shared tombstone set, so they don't need this — it's for the detail screen,
   * which must navigate away once its post no longer exists.
   */
  onDeleted?: () => void;
  /**
   * Feed viewport flag forwarded to <PostVideo> — off-screen cards freeze to the
   * poster instead of streaming. Left undefined on surfaces without viewport
   * tracking (profile / venue / artist), which then hold the poster: those lists
   * mount every card at once, so autoplay there would be one live stream per
   * video post. Tapping opens the detail screen, which plays.
   */
  activeVideo?: boolean;
};

const CAPTION_PREVIEW_LIMIT = 120;
/** Heart fill once a post is liked — a warm red that reads as positive against the dark surface. */
const LIKE_COLOR = '#FF4D6D';

/**
 * Like control with an optimistic heart that pops on like (skipped under reduced
 * motion) and fires a light haptic on iOS. The fill itself is driven by `liked`,
 * which flows back through the optimistically-patched query cache.
 */
function LikeButton({
  liked,
  pending,
  onPress,
}: {
  liked: boolean;
  pending: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const reduceMotion = useReducedMotion();
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePress = () => {
    // Only celebrate the like, not the unlike (matches familiar feed behaviour).
    if (!liked) {
      if (!reduceMotion) {
        scale.value = withSequence(
          withTiming(1.25, { duration: 120 }),
          withTiming(1, { duration: 120 })
        );
      }
      if (Platform.OS === 'ios') {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={11}
      disabled={pending}
      accessibilityRole="button"
      accessibilityLabel={liked ? 'Unlike post' : 'Like post'}
      accessibilityState={{ selected: liked }}
    >
      <Animated.View style={animatedStyle}>
        <Ionicons
          name={liked ? 'heart' : 'heart-outline'}
          size={24}
          color={liked ? LIKE_COLOR : '#FFFFFF'}
        />
      </Animated.View>
    </Pressable>
  );
}

/**
 * Text-only Follow CTA shown in the post header for non-owner artist/venue
 * authors. Lime accent (`green-10`) while not following, muted once followed —
 * mirroring the toggle on the profile header. The optimistic flip comes from
 * useProfileFollowHandler, so the tap feels instant.
 */
function FollowButton({
  isFollowing,
  displayName,
  onPress,
}: {
  isFollowing: boolean;
  displayName: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={11}
      accessibilityRole="button"
      accessibilityLabel={isFollowing ? `Following ${displayName}` : `Follow ${displayName}`}
      accessibilityState={{ selected: isFollowing }}
    >
      <Text
        className={`text-xs font-bold uppercase tracking-wider font-urbanist ${
          isFollowing ? 'text-white/40' : 'text-green-10'
        }`}
      >
        {isFollowing ? 'Following' : 'Follow'}
      </Text>
    </Pressable>
  );
}

export function PostCard({
  post,
  currentUserId,
  hideAuthorHeader,
  expanded,
  onDeleted,
  activeVideo,
}: Props) {
  const isOwner = currentUserId === post.createdBy;
  // Like state is derived straight from props. useTogglePostLike patches the
  // query cache optimistically, so these values flow back through the feed /
  // detail data the instant the user taps — no local copy to drift out of sync.
  const liked = post.likedByMe;
  const likeCount = post.likeCount ?? 0;

  const { onLikePress, isPending: likePending } = useLikeHandler(post.id);
  const { open: openLikersSheet } = useLikersSheetControls();
  const deletePost = useDeletePost();
  const sharePost = useSharePost();
  const segments = useSegments();

  const onSharePress = () => {
    void sharePost(post.id, post.caption);
  };

  const onEdit = () => {
    router.push({ pathname: '/(app)/create/post', params: { editId: post.id } });
  };

  const onDelete = () => {
    deletePost.mutate({ id: post.id }, { onSuccess: () => onDeleted?.() });
  };

  const openDetail = () => {
    // A promo post is a live view of its event — tapping opens the event, not a
    // post-detail screen. Route within the current tab's stack so back / tab
    // context is preserved (segments: ['(app)','(tabs)','<tab>', …]); fall back
    // to the top-level deep-link shim when not inside a tab (e.g. post detail).
    if (post.eventId) {
      const target =
        segments[1] === '(tabs)' && segments[2]
          ? (`/(app)/(tabs)/${segments[2]}/event/${post.eventId}` as Href)
          : (`/(app)/event/${post.eventId}` as Href);
      router.push(target);
      return;
    }
    router.push({ pathname: '/(app)/post/[postId]', params: { postId: post.id } });
  };

  // Spectators have no public profile, so only artist / venue authors are tappable.
  const canViewProfile =
    post.author.profileType === 'artist' || post.author.profileType === 'venue';

  // Optimistic follow toggle for the header CTA. Only meaningful for followable
  // (artist / venue) authors that aren't the viewer — the CTA itself is gated on
  // !isOwner && canViewProfile below.
  const { isFollowing, onFollowPress } = useProfileFollowHandler({
    userId: post.author.id,
    isFollowing: post.author.isFollowedByMe,
  });
  const openAuthorProfile = () => {
    if (post.author.profileType === 'venue') {
      router.push({ pathname: '/(app)/venue/[venueId]', params: { venueId: post.author.id } });
    } else if (post.author.profileType === 'artist') {
      router.push({ pathname: '/(app)/artist/[artistId]', params: { artistId: post.author.id } });
    }
  };

  const createdAtIso =
    typeof post.createdAt === 'string' ? post.createdAt : post.createdAt.toISOString();
  const createdLabel = formatPostTimestamp(createdAtIso);

  // In expanded (detail) mode show the whole caption; in preview mode truncate
  // and offer a read-more affordance that opens the detail screen.
  const showReadMore = !expanded && post.caption.length > CAPTION_PREVIEW_LIMIT;
  const caption = showReadMore
    ? post.caption.slice(0, CAPTION_PREVIEW_LIMIT).trimEnd()
    : post.caption;

  // Caption-only posts read backwards if the actions sit above the caption (the
  // caption is the whole post), so for those we render the caption first. With
  // media present, the media is the content shown first and actions follow it.
  const hasMedia = (post.mediaType === 'image' && post.mediaUrl) || post.mediaType === 'video';

  // The author name is shown in the header row (feed) or the profile header
  // (profile tabs), so it's never repeated here.
  // A URL past the preview cutoff can render cut mid-link; the detail view shows it whole.
  const captionBlock = (
    <Text className={`text-sm leading-5 text-white font-urbanist ${hasMedia ? '' : 'mb-2'}`}>
      {splitCaptionLinks(caption).map((segment, index) =>
        segment.type === 'url' ? (
          <Text
            key={index}
            className="text-blue-10 underline"
            accessibilityRole="link"
            onPress={() => {
              void WebBrowser.openBrowserAsync(segment.href).catch(() => {});
            }}
          >
            {segment.value}
          </Text>
        ) : (
          segment.value
        )
      )}
      {showReadMore && <Text className="font-medium text-blue-10">… more</Text>}
    </Text>
  );

  const actionsRow = (
    <View className={`flex-row items-start gap-4 ${hasMedia ? 'mb-2' : ''}`}>
      {/* Like count sits directly beneath the heart so it stays tied to the action
          that drives it (the share icon top-aligns alongside, no count of its own). */}
      <View className="items-center">
        <LikeButton liked={liked} pending={likePending} onPress={onLikePress} />
        {likeCount > 0 && (
          <Pressable
            onPress={() => openLikersSheet(post.id)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`${likeCount} ${likeCount === 1 ? 'like' : 'likes'}, view who liked this`}
          >
            <Text className="mt-0.5 text-xs text-white/60 font-urbanist">{likeCount}</Text>
          </Pressable>
        )}
      </View>
      <Pressable
        onPress={onSharePress}
        hitSlop={11}
        accessibilityRole="button"
        accessibilityLabel="Share post"
      >
        <Ionicons name="share-outline" size={24} color="#FFFFFF" />
      </Pressable>
    </View>
  );

  // Author identity (avatar + name + time) — wrapped in a Pressable only when the
  // author has a viewable profile, so non-tappable authors let taps fall through
  // to the card's openDetail.
  const authorIdentity = (
    <>
      {post.author.profileImageUrl ? (
        <Image
          source={{ uri: post.author.profileImageUrl }}
          className="h-9 w-9 rounded-full bg-white/10"
        />
      ) : (
        <View className="h-9 w-9 rounded-full bg-white/10 items-center justify-center">
          <Ionicons name="person-outline" size={16} color="#8d8d8d" />
        </View>
      )}
      <View className="flex-1">
        <Text numberOfLines={1} className="text-sm font-medium text-white font-urbanist">
          {post.author.displayName}
        </Text>
        <Text className="text-xs text-white/50 font-urbanist">{createdLabel}</Text>
      </View>
    </>
  );

  return (
    <Pressable
      onPress={expanded ? undefined : openDetail}
      className="mb-4 rounded-2xl border border-[rgba(141,141,141,0.4)] bg-[rgba(141,141,141,0.1)] p-4 active:opacity-90"
    >
      {/* Author header */}
      {hideAuthorHeader ? (
        <Text className="mb-2 text-xs text-white/40 font-urbanist">{createdLabel}</Text>
      ) : (
        <View className="mb-3 flex-row items-center justify-between">
          {canViewProfile ? (
            <Pressable
              onPress={openAuthorProfile}
              className="flex-1 flex-row items-center gap-3 active:opacity-70"
              accessibilityRole="button"
              accessibilityLabel={`View ${post.author.displayName}'s profile`}
            >
              {authorIdentity}
            </Pressable>
          ) : (
            <View className="flex-1 flex-row items-center gap-3">{authorIdentity}</View>
          )}
          {isOwner ? (
            // Promo posts are managed via their event — no direct edit/delete.
            post.eventId ? null : (
              <PostActionMenu onEdit={onEdit} onDelete={onDelete} />
            )
          ) : (
            canViewProfile && (
              <FollowButton
                isFollowing={isFollowing}
                displayName={post.author.displayName}
                onPress={onFollowPress}
              />
            )
          )}
        </View>
      )}

      {/* Media */}
      {post.mediaType === 'image' && post.mediaUrl && (
        <PostImage uri={post.mediaUrl} expanded={expanded} />
      )}
      {post.mediaType === 'video' && (
        <PostVideo
          mediaUrl={post.mediaUrl}
          muxStatus={post.muxStatus ?? null}
          muxPlaybackId={post.muxPlaybackId ?? null}
          active={expanded === true || activeVideo === true}
        />
      )}

      {/* Content first: media posts show media → actions → caption; caption-only
          posts show caption → actions so the actions never sit above content. */}
      {hasMedia ? (
        <>
          {actionsRow}
          {captionBlock}
        </>
      ) : (
        <>
          {captionBlock}
          {actionsRow}
        </>
      )}

      {/* Owner-only "Ended" marker (top-right). Gated on isOwner AND the
          server-only eventEnded flag, so it never renders for a visitor viewing
          this profile — a non-owner never even receives an ended promo row. */}
      {isOwner && post.eventId && post.eventEnded && (
        <View className="absolute right-3 top-3 rounded-lg bg-[#F59E0B] px-2 py-1">
          <Text className="text-[10px] font-bold text-black font-urbanist">Ended</Text>
        </View>
      )}
    </Pressable>
  );
}
