import { useGuestGate } from '@/hooks/use-guest-gate';
import { useSaveEvent } from '@/hooks/use-save-event';

type SavableEvent = { id: string; isSaved: boolean };

/**
 * Owns the Save/bookmark toggle for an event, gating it behind sign-in.
 *
 * `events.save`/`events.unsave` are protected procedures, so a guest ("Skip
 * sign-in") firing them just 401s and the optimistic bookmark snaps back with no
 * feedback — reported as a silent failure (Asana 1216227544201487). We nudge the
 * guest to sign-in instead, mirroring the follow CTA (useProfileFollowHandler).
 */
export function useSaveHandler(event: SavableEvent) {
  const { isAuthenticated, promptSignIn } = useGuestGate();
  const { mutate: saveEvent } = useSaveEvent();

  const onToggleSave = () => {
    if (!isAuthenticated) {
      promptSignIn('Sign in to save events');
      return;
    }
    // Optimistic update + error rollback live in useSaveEvent's cache patch.
    saveEvent({ eventId: event.id, saved: !event.isSaved });
  };

  return { onToggleSave };
}
