import { useMutation, useQueryClient } from '@tanstack/react-query';

import { trpc } from '@/utils/trpc';

// Invalidates the inbox list + unread-count after a read mutation so the
// bell badge and current page both refresh without a manual reload.
function invalidateInbox(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: [['notifications', 'list']] });
  void queryClient.invalidateQueries({ queryKey: [['notifications', 'unreadCount']] });
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();
  const mutationOptions = trpc.notifications.markAsRead.mutationOptions();

  return useMutation({
    ...mutationOptions,
    onSuccess: () => invalidateInbox(queryClient),
  });
}

export function useMarkAllAsRead() {
  const queryClient = useQueryClient();
  const mutationOptions = trpc.notifications.markAllAsRead.mutationOptions();

  return useMutation({
    ...mutationOptions,
    onSuccess: () => invalidateInbox(queryClient),
  });
}
