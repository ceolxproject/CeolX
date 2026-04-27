import { useQuery } from '@tanstack/react-query';

import { trpc } from '@/utils/trpc';

type UseEventByIdOpts = {
  id: string;
  enabled?: boolean;
};

export function useEventById({ id, enabled }: UseEventByIdOpts) {
  return useQuery(trpc.events.byId.queryOptions({ id: id || '' }, { enabled: enabled ?? !!id }));
}
