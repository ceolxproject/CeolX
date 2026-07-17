import { QueryCache, QueryClient } from '@tanstack/react-query';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { inferRouterOutputs } from '@trpc/server';
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query';
import { Platform } from 'react-native';

import type { AppRouter } from '@CeolX/api/routers/index';
import { env } from '@CeolX/env/native';

import { handleQueryError } from './query-error-handler';

import { authClient } from '@/lib/auth-client';

export type RouterOutputs = inferRouterOutputs<AppRouter>;

export const queryClient = new QueryClient({
  // A failed *query* carrying a tRPC UNAUTHORIZED signs the user out (backstop
  // for a session revoked while the app was foregrounded). Mutations are NOT
  // wired here — they keep their per-call-site "session expired" toast so a
  // half-filled form is never torn down. See utils/query-error-handler.ts.
  queryCache: new QueryCache({
    onError: (error) => handleQueryError(error),
  }),
});

export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${env.EXPO_PUBLIC_SERVER_URL}/trpc`,
      fetch: function (url, options) {
        return fetch(url, {
          ...options,
          // Better Auth Expo forwards the session cookie manually on native.
          credentials: Platform.OS === 'web' ? 'include' : 'omit',
        });
      },
      headers() {
        if (Platform.OS === 'web') {
          return {};
        }
        const headers = new Map<string, string>();
        const cookies = authClient.getCookie();
        if (cookies) {
          headers.set('Cookie', cookies);
        }
        return Object.fromEntries(headers);
      },
    }),
  ],
});

export const trpc = createTRPCOptionsProxy<AppRouter>({
  client: trpcClient,
  queryClient,
});
