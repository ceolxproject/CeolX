import { useQuery } from '@tanstack/react-query';

import { trpc } from '@/utils/trpc';

export function useEventAnalytics(eventId: string | undefined) {
  const queryOptions = trpc.events.analytics.queryOptions(
    { id: eventId ?? '' },
    {
      enabled: !!eventId,
      staleTime: 5 * 60 * 1000, // matches the server-side cache window
    }
  );

  return useQuery(queryOptions);
}
