import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { Platform } from 'react-native';

import type { AppRouter } from '@CeolX/api/routers/index';
import { env } from '@CeolX/env/native';
import type { FeedResponse } from '@CeolX/shared';

import { authClient } from '@/lib/auth-client';

// Use a standalone tRPC client for mutations (the proxy from trpc.ts is for queryOptions only)
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

type SaveEventArgs = {
  eventId: string;
  saved: boolean; // true = save, false = unsave
};

export function useSaveEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ eventId, saved }: SaveEventArgs) => {
      if (saved) {
        return trpcClient.events.save.mutate({ id: eventId });
      }
      return trpcClient.events.unsave.mutate({ id: eventId });
    },
    onMutate: async ({ eventId, saved }) => {
      // Cancel outgoing feed queries to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: [['events', 'getFeed']] });

      // Optimistically update all feed query caches
      queryClient.setQueriesData<FeedResponse>({ queryKey: [['events', 'getFeed']] }, (old) => {
        if (!old) return old;
        return {
          ...old,
          events: old.events.map((event) =>
            event.id === eventId
              ? {
                  ...event,
                  isSaved: saved,
                  joinedCount: event.joinedCount + (saved ? 1 : -1),
                }
              : event
          ),
        };
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: [['events', 'getFeed']] });
    },
  });
}
