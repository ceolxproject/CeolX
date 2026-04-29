import { useMutation } from '@tanstack/react-query';

import { trpc } from '@/utils/trpc';

// Fire-and-forget — the mutation runs in the background while the user is
// already being routed to the external ticket URL. Failures are silent.
export function useTrackTicketClick() {
  return useMutation(trpc.events.trackTicketClick.mutationOptions());
}
