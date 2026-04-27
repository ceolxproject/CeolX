import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert } from 'react-native';

import { trpc } from '@/utils/trpc';

export function useRequestToPerform() {
  const queryClient = useQueryClient();
  const [hasRequested, setHasRequested] = useState(false);

  const { mutate, isPending: isRequesting } = useMutation(
    trpc.bookings.requestToPerform.mutationOptions({
      onSuccess: () => {
        setHasRequested(true);
        Alert.alert('Request Sent!', 'The venue will review your request.');
        void queryClient.invalidateQueries({ queryKey: [['bookings']] });
      },
      onError: (error) => {
        if (error.message.includes('already applied')) {
          setHasRequested(true);
          Alert.alert('Already Applied', "You've already applied to this event.");
        } else if (error.message.includes('already a collaborator')) {
          Alert.alert('Already Booked', 'You are already a collaborator on this event.');
        } else {
          Alert.alert('Error', error.message || 'Failed to send request');
        }
      },
    })
  );

  const requestToPerform = (eventId: string) => {
    mutate({ eventId });
  };

  return { requestToPerform, isRequesting, hasRequested };
}
