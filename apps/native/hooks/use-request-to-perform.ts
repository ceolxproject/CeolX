import { useMutation, useQueryClient } from '@tanstack/react-query';

import { appToast } from '@/components/AppToast';
import { trpc } from '@/utils/trpc';

export function useRequestToPerform() {
  const queryClient = useQueryClient();

  // The "Request Sent" vs "Request to Perform" CTA is driven by the server's
  // events.byId `viewerHasPendingRequest`, so a request (or an "already applied"
  // conflict) just needs to refetch the event detail — no local sticky flag,
  // which previously left the button stuck after a withdraw. (Asana 1215700058851990)
  const refreshRequestState = () => {
    void queryClient.invalidateQueries({ queryKey: [['bookings']] });
    void queryClient.invalidateQueries({ queryKey: [['events', 'byId']] });
  };

  const { mutate, isPending: isRequesting } = useMutation(
    trpc.bookings.requestToPerform.mutationOptions({
      onSuccess: () => {
        appToast.success('Request Sent!', 'The venue will review your request.');
        refreshRequestState();
      },
      onError: (error) => {
        if (error.message.includes('already applied')) {
          appToast.info('Already Applied', "You've already applied to this event.");
          refreshRequestState();
        } else if (error.message.includes('already a collaborator')) {
          appToast.info('Already Booked', 'You are already a collaborator on this event.');
        } else {
          appToast.error('Error', error.message || 'Failed to send request');
        }
      },
    })
  );

  const requestToPerform = (eventId: string) => {
    mutate({ eventId });
  };

  return { requestToPerform, isRequesting };
}
