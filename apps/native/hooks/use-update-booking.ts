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
      void queryClient.invalidateQueries({ queryKey: [['bookings', 'list']] });
    },
  });
}
