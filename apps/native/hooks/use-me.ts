import { useQuery } from '@tanstack/react-query';

import { trpc } from '@/utils/trpc';

type UseMeOpts = {
  enabled?: boolean;
};

export function useMe(opts?: UseMeOpts) {
  return useQuery({
    ...trpc.users.me.queryOptions(),
    ...(opts?.enabled !== undefined && { enabled: opts.enabled }),
  });
}
