import { useQuery } from '@tanstack/react-query';

import { trpc } from '@/utils/trpc';

export function useVenueProfile(id: string) {
  return useQuery({
    ...trpc.venues.byId.queryOptions({ id }),
    enabled: !!id,
  });
}
