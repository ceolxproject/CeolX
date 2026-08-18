import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/contexts/auth-context';
import { trpc, type RouterOutputs } from '@/utils/trpc';

type UseMeOpts = {
  enabled?: boolean;
  /**
   * Poll while mounted. Off by default.
   *
   * Only one surface wants this: a venue waiting for an activation it completes in a
   * browser, often on another device (D-16). Nothing in the app can observe that payment,
   * so the alternative is the venue staring at a stale screen. TanStack pauses the
   * interval when the app is unfocused, so this never polls in the background.
   *
   * The callback form is the useful one — it is re-evaluated against live query state, so a
   * poll can switch itself off the moment the thing it was waiting for arrives, with no
   * mirrored component state to drift from it.
   */
  refetchInterval?:
    | number
    | false
    | ((query: { state: { data?: RouterOutputs['users']['me'] } }) => number | false);
};

export function useMe(opts?: UseMeOpts) {
  const { isAuthenticated, isGuest } = useAuth();

  // users.me is a protected procedure — it 401s for guest/unauthenticated
  // sessions. Because every useMe() call site observes the SAME query-cache
  // key, a single unguarded caller (AppTabBar, Discover, Profile…) firing it
  // for a guest poisons the shared entry with an error that the (app)/_layout
  // effect picks up and turns into the "Retrying your session…" toast loop.
  // Gating here keeps the query disabled for guests at every call site.
  const enabled = (opts?.enabled ?? true) && isAuthenticated && !isGuest;

  const query = useQuery({
    ...trpc.users.me.queryOptions(),
    enabled,
    refetchInterval: opts?.refetchInterval ?? false,
  });

  // A disabled useQuery still returns whatever is already in the shared cache.
  // After a logged-in artist/venue logs out, their users.me entry lingers in the
  // singleton queryClient, so a guest who then taps "Skip" would read the prior
  // role and see the creator view (FAB, etc.) until the next cold start. Mask
  // the data whenever the query is disabled so no consumer can render a stale
  // persona — the role only ever comes from the *current* session.
  return enabled ? query : { ...query, data: undefined };
}
