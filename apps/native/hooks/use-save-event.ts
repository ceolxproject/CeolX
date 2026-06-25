import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { Platform } from 'react-native';

import type { AppRouter } from '@CeolX/api/routers/index';
import { env } from '@CeolX/env/native';

import {
  applySaveOptimisticUpdate,
  invalidateSaveQueries,
  rollbackSaveOptimisticUpdate,
  type SaveOptimisticSnapshot,
} from './save-event-cache';

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

  return useMutation<{ saved: boolean }, Error, SaveEventArgs, SaveOptimisticSnapshot>({
    mutationFn: async ({ eventId, saved }: SaveEventArgs) => {
      if (saved) {
        return trpcClient.events.save.mutate({ id: eventId });
      }
      return trpcClient.events.unsave.mutate({ id: eventId });
    },
    onMutate: async ({ eventId, saved }) => {
      // Cancel in-flight reads of the caches we're about to patch so a late
      // response can't clobber the optimistic value.
      await queryClient.cancelQueries({ queryKey: [['events', 'getFeed']] });
      await queryClient.cancelQueries({ queryKey: [['events', 'byId']] });

      // Patch the feed AND the event-detail (byId) caches together — the detail
      // header reads byId.isSaved, so feed-only patching left it stale.
      return applySaveOptimisticUpdate(queryClient, eventId, saved);
    },
    onError: (_error, _variables, snapshot) => {
      if (snapshot) rollbackSaveOptimisticUpdate(queryClient, snapshot);
    },
    onSettled: () => {
      invalidateSaveQueries(queryClient);
    },
  });
}
