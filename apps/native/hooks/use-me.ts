import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/contexts/auth-context';
import { trpc } from '@/utils/trpc';

type UseMeOpts = {
  enabled?: boolean;
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

  return useQuery({
    ...trpc.users.me.queryOptions(),
    enabled,
  });
}
