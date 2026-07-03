import { useEffect, useState } from 'react';

import { getLocationSetupComplete } from '@/utils/location-setup';

export type LocationSetupGateState = 'checking' | 'needed' | 'done';

/**
 * Reads the persisted per-user "location setup complete" flag. Used by the
 * (app) layout guard to send users who haven't done the onboarding location step
 * to `/(auth)/set-location`. Returns `checking` until the (async) read resolves
 * so the guard holds rather than flashing the app.
 *
 * Keyed by `userId` (completion is per-account — see utils/location-setup). The
 * AuthProvider mounts once at the app root and never unmounts on logout, so this
 * hook stays mounted across an account switch; the effect must therefore react
 * to `userId` changing, not just to mount.
 *
 * Re-evaluated naturally: completing the step replaces to `/(app)/(tabs)/map`,
 * remounting the (app) layout (and therefore this hook), which reads the now-set
 * flag and resolves to `done`.
 */
export function useLocationSetupGate(userId: string | undefined): LocationSetupGateState {
  const [state, setState] = useState<LocationSetupGateState>('checking');

  useEffect(() => {
    // No identified user yet (session / meData still resolving). We can't
    // attribute completion to anyone, so hold in `checking` — never let the
    // guard advance to `needed`/`done` on an unknown user.
    if (!userId) {
      setState('checking');
      return;
    }

    // Reset before the async read so a lingering `done`/`needed` from a PREVIOUS
    // account (this hook is never unmounted across logout) can't be acted on for
    // a render while this user's read is in flight.
    setState('checking');

    let active = true;
    void getLocationSetupComplete(userId).then((complete) => {
      // Ignore a resolve that lands after `userId` changed or the hook unmounted.
      if (active) setState(complete ? 'done' : 'needed');
    });
    return () => {
      active = false;
    };
  }, [userId]);

  return state;
}
