import { useState } from 'react';

import { useFollow } from '@/hooks/use-follow';

type FollowableProfile = { userId: string; isFollowing: boolean } | null | undefined;

/**
 * Shared optimistic follow/unfollow handler used by both artist and venue profile screens.
 * Flips UI immediately, rolls back on error, clears the override when the mutation settles
 * (cache invalidation in useFollow refetches the real value).
 */
export function useProfileFollowHandler(profile: FollowableProfile) {
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const mutation = useFollow();

  const isFollowing = optimistic ?? profile?.isFollowing ?? false;

  const onFollowPress = () => {
    if (!profile) return;
    const prev = isFollowing;
    setOptimistic(!prev);
    mutation.mutate(
      { followeeId: profile.userId, isFollowing: prev },
      { onSettled: () => setOptimistic(null) }
    );
  };

  return { isFollowing, onFollowPress };
}
