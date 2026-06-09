import { useMutation } from '@tanstack/react-query';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { Platform } from 'react-native';

import type { AppRouter } from '@CeolX/api/routers/index';
import { env } from '@CeolX/env/native';

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

/**
 * Re-sends a still-pending invite/request notification to the recipient.
 * Status is unchanged, so there is nothing to invalidate — the caller drives
 * the loading + toast feedback off the mutation state.
 */
export function useResendBooking() {
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      return trpcClient.bookings.resend.mutate({ id });
    },
  });
}
