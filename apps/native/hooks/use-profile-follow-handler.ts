import { useEffect, useState } from 'react';

import { appToast } from '@/components/AppToast';
import { useFollow } from '@/hooks/use-follow';

type FollowableProfile = { userId: string; isFollowing: boolean } | null | undefined;

/**
 * Shared optimistic follow/unfollow handler used by both artist and venue profile screens.
 * Flips the UI immediately and rolls back on error. The override is held until the
 * refetched server value (profile.isFollowing) catches up, then reconciled away.
 *
 * Clearing the override on `onSettled` was the bug: invalidation fires there but the
 * byId refetch is still in flight, so the button briefly snapped back to the stale
 * value before flipping forward again — the "unexpected toggle".
 */
export function useProfileFollowHandler(profile: FollowableProfile) {
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const mutation = useFollow();

  const isFollowing = optimistic ?? profile?.isFollowing ?? false;

  // Once the refetched server value matches what we optimistically set, drop the
  // override so the prop becomes the single source of truth again (no flicker).
  useEffect(() => {
    if (optimistic !== null && profile?.isFollowing === optimistic) {
      setOptimistic(null);
    }
  }, [optimistic, profile?.isFollowing]);

  const onFollowPress = () => {
    if (!profile) return;
    const prev = isFollowing;
    setOptimistic(!prev);
    mutation.mutate(
      { followeeId: profile.userId, isFollowing: prev },
      // Roll back to the real value on failure; success is reconciled by the effect.
      // Surface the failure too — without this the button silently snapped back to
      // its prior state, reading as an unresponsive tap on every post-card/profile CTA.
      {
        onError: () => {
          setOptimistic(null);
          appToast.error(prev ? 'Could not unfollow' : 'Could not follow', 'Please try again.');
        },
      }
    );
  };

  return { isFollowing, onFollowPress };
}
