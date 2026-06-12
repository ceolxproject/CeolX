import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { Platform } from 'react-native';

import type { AppRouter } from '@CeolX/api/routers/index';
import { env } from '@CeolX/env/native';

import { authClient } from '@/lib/auth-client';

type UpdateableStatus = 'accepted' | 'rejected' | 'cancelled';

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

type UpdateBookingArgs = {
  id: string;
  status: UpdateableStatus;
};

export function useUpdateBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: UpdateBookingArgs) => {
      return trpcClient.bookings.update.mutate({ id, status });
    },
    onSettled: () => {
      // Invalidate BOTH the list AND the per-booking detail query. The detail
      // screen (bookings.byId) gates the WITHDRAW/ACCEPT buttons on status, so
      // if we only refresh the list it keeps showing a stale "pending" booking
      // — letting the user tap WITHDRAW again and hit the raw
      // "Cannot transition from cancelled to cancelled" backend error.
      void queryClient.invalidateQueries({ queryKey: [['bookings', 'list']] });
      void queryClient.invalidateQueries({ queryKey: [['bookings', 'byId']] });
    },
  });
}
