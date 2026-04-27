import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/contexts/auth-context';
import { trpc } from '@/utils/trpc';

// Polls notifications.unreadCount every 30s while the user is signed in.
// V1 V2 will replace polling with a WebSocket push triggered by FCM receipt.
const POLL_INTERVAL_MS = 30_000;

export function useUnreadBadgeCount(): number {
  const { user, isGuest } = useAuth();
  const enabled = !!user && !isGuest;

  const { data } = useQuery({
    ...trpc.notifications.unreadCount.queryOptions(),
    enabled,
    refetchInterval: enabled ? POLL_INTERVAL_MS : false,
    refetchIntervalInBackground: false,
  });

  return data?.count ?? 0;
}
