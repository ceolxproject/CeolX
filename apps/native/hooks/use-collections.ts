import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { Platform } from 'react-native';

import type { AppRouter } from '@CeolX/api/routers/index';
import { env } from '@CeolX/env/native';
import type { CreateCollectionInput } from '@CeolX/shared/validators';

import { authClient } from '@/lib/auth-client';
import { trpc } from '@/utils/trpc';

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

// ─── List hook ──────────────────────────────────────────────────────────────

export function useCollections() {
  const queryOptions = trpc.collections.list.queryOptions();
  return useQuery(queryOptions);
}

// ─── Detail hook ────────────────────────────────────────────────────────────

export function useCollection(id: string | undefined) {
  const queryOptions = trpc.collections.byId.queryOptions({ id: id ?? '' }, { enabled: !!id });
  return useQuery(queryOptions);
}

// ─── Mutations ──────────────────────────────────────────────────────────────

export function useCreateCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateCollectionInput) => trpcClient.collections.create.mutate(input),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: [['collections', 'list']] });
    },
  });
}

export function useUpdateCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { id: string; data: Partial<CreateCollectionInput> }) =>
      trpcClient.collections.update.mutate(input),
    onSettled: (_data, _error, variables) => {
      void queryClient.invalidateQueries({ queryKey: [['collections', 'list']] });
      void queryClient.invalidateQueries({
        queryKey: [['collections', 'byId'], { input: { id: variables.id } }],
      });
    },
  });
}

export function useDeleteCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => trpcClient.collections.delete.mutate({ id }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: [['collections', 'list']] });
    },
  });
}
