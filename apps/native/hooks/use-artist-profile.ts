import { useQuery } from '@tanstack/react-query';

import { trpc } from '@/utils/trpc';

export function useArtistProfile(id: string) {
  return useQuery({
    ...trpc.artists.byId.queryOptions({ id }),
    enabled: !!id,
  });
}
