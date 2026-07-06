import { useGuestGate } from '@/hooks/use-guest-gate';
import { useTogglePostLike } from '@/hooks/use-toggle-post-like';

/**
 * Owns the like toggle for a post, gating it behind sign-in.
 *
 * `posts.feed` is public so guests ("Skip sign-in") can browse posts, but
 * `posts.toggleLike` is a protected procedure — a guest firing it just 401s and
 * the optimistic heart snaps back with no feedback (the same silent failure
 * class as event Save, Asana 1216227544201487). We nudge the guest to sign-in
 * instead, mirroring useSaveHandler / the follow CTA. (Asana 1216227543475896)
 */
export function useLikeHandler(postId: string) {
  const { isAuthenticated, promptSignIn } = useGuestGate();
  const toggleLike = useTogglePostLike();

  const onLikePress = () => {
    if (!isAuthenticated) {
      promptSignIn('Sign in to like posts');
      return;
    }
    // Optimistic heart + error rollback live in useTogglePostLike's cache patch.
    toggleLike.mutate({ postId });
  };

  return { onLikePress, isPending: toggleLike.isPending };
}
