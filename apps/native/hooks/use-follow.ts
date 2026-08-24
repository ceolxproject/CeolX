import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { Platform } from 'react-native';

import type { AppRouter } from '@CeolX/api/routers/index';
import { env } from '@CeolX/env/native';

import { AnalyticsEvent, track } from '@/lib/analytics';
import { authClient } from '@/lib/auth-client';

const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${env.EXPO_PUBLIC_SERVER_URL}/trpc`,
      fetch: (url, options) =>
        fetch(url, {
          ...options,
          credentials: Platform.OS === 'web' ? 'include' : 'omit',
        }),
      headers() {
        if (Platform.OS === 'web') return {};
        const cookies = authClient.getCookie();
        return cookies ? { Cookie: cookies } : {};
      },
    }),
  ],
});

type UseFollowArgs = {
  followeeId: string;
  isFollowing: boolean;
};

export function useFollow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ followeeId, isFollowing }: UseFollowArgs) => {
      if (isFollowing) {
        return trpcClient.follows.unfollow.mutate({ followeeId });
      }
      return trpcClient.follows.follow.mutate({ followeeId });
    },
    // `followed: false` is an unfollow. Both directions are recorded because the
    // interesting number is net follow growth, which a follow-only event can't give.
    onSuccess: (_data, { isFollowing }) => {
      track(AnalyticsEvent.PROFILE_FOLLOWED, { followed: !isFollowing });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: [['artists', 'byId']] });
      void queryClient.invalidateQueries({ queryKey: [['artists', 'me']] });
      void queryClient.invalidateQueries({ queryKey: [['venues', 'byId']] });
      void queryClient.invalidateQueries({ queryKey: [['venues', 'me']] });
      void queryClient.invalidateQueries({ queryKey: [['users', 'me']] });
      void queryClient.invalidateQueries({ queryKey: [['follows']] });
      // Refetch post feeds/detail so author follow state (the post-card CTA)
      // reconciles across every surface, not just the tapped profile header.
      void queryClient.invalidateQueries({ queryKey: [['posts']] });
    },
  });
}
