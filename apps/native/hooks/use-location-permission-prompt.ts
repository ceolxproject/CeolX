import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';

/** Three states to avoid a flash of the map before the permission read resolves. */
export type LocationPromptState = 'checking' | 'show' | 'done';

type Result = {
  promptState: LocationPromptState;
  /**
   * True when the user dismissed the priming screen by choosing to set their
   * location manually. The map reads this as a neutral "focus the search bar on
   * mount" signal — it never learns *why*, keeping it decoupled from onboarding.
   */
  focusSearchOnMount: boolean;
  /**
   * Call after the user responds to the permission priming screen.
   * `viaManualSelection` records that they tapped "Select location manually" so
   * the next surface can drop them straight into the place search.
   */
  markSeen: (opts?: { viaManualSelection?: boolean }) => Promise<void>;
};

/**
 * Pure decision for whether to show the priming screen.
 *
 * - GRANTED → never prompt again.
 * - not granted (undetermined OR denied) → prompt, but at most once per app
 *   launch (the `shownThisSession` guard). We deliberately re-ask denied users
 *   on each cold start instead of suppressing forever — a one-time "asked" flag
 *   meant a user who denied was never asked again. The actual re-ask (OS dialog
 *   vs Settings deep-link) is handled by LocationPermissionScreen.
 */
export function resolvePromptState(
  status: Location.PermissionStatus,
  shownThisSession: boolean
): LocationPromptState {
  if (status === Location.PermissionStatus.GRANTED) return 'done';
  return shownThisSession ? 'done' : 'show';
}

// Module-scoped so it survives Map-tab re-mounts within a session but resets on
// a cold start (fresh JS runtime). This is what makes the cadence "ask at most
// once per app launch" rather than on every tab focus.
let shownThisSession = false;

/**
 * Determines whether to show the location permission priming screen.
 *
 * - 'checking' → permission read in progress; render nothing
 * - 'show'     → permission not granted and not yet shown this session
 * - 'done'     → granted, or already shown this session → skip to map
 */
export function useLocationPermissionPrompt(): Result {
  const [promptState, setPromptState] = useState<LocationPromptState>('checking');
  const [focusSearchOnMount, setFocusSearchOnMount] = useState(false);

  useEffect(() => {
    async function check() {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        setPromptState(resolvePromptState(status, shownThisSession));
      } catch {
        // Permission read failed → don't block the map.
        setPromptState('done');
      }
    }

    void check();
  }, []);

  const markSeen = useCallback((opts?: { viaManualSelection?: boolean }) => {
    shownThisSession = true;
    if (opts?.viaManualSelection) setFocusSearchOnMount(true);
    setPromptState('done');
    return Promise.resolve();
  }, []);

  return { promptState, focusSearchOnMount, markSeen };
}
