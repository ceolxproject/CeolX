import { useEffect, useState } from 'react';

import { getLocationSetupComplete } from '@/utils/location-setup';

export type LocationSetupGateState = 'checking' | 'needed' | 'done';

/**
 * Reads the persisted "location setup complete" flag once on mount. Used by the
 * (app) layout guard to send users who haven't done the onboarding location step
 * to `/(auth)/set-location`. Returns `checking` until the (async) read resolves
 * so the guard holds rather than flashing the app.
 *
 * Re-evaluated naturally: completing the step replaces to `/(app)/(tabs)/map`,
 * remounting the (app) layout (and therefore this hook), which reads the now-set
 * flag and resolves to `done`.
 */
export function useLocationSetupGate(): LocationSetupGateState {
  const [state, setState] = useState<LocationSetupGateState>('checking');

  useEffect(() => {
    let active = true;
    void getLocationSetupComplete().then((complete) => {
      if (active) setState(complete ? 'done' : 'needed');
    });
    return () => {
      active = false;
    };
  }, []);

  return state;
}
