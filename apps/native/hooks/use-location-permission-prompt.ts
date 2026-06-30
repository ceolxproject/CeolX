import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';

import { getBaseLocation } from '@/utils/base-location';
import { getLocationSetupComplete } from '@/utils/location-setup';

/** Three states to avoid a flash of the map before the permission read resolves. */
export type LocationPromptState = 'checking' | 'show' | 'done';

type Result = {
  promptState: LocationPromptState;
  /**
   * Call after the user responds to the permission priming screen.
   * The `viaManualSelection` routing signal lives on
   * `LocationPermissionScreen.onDone` — the map reads it there and navigates
   * directly, so the hook no longer needs to track it.
   */
  markSeen: () => Promise<void>;
};

/**
 * Pure decision for whether to show the priming screen.
 *
 * - GRANTED → never prompt (GPS resolves silently).
 * - A saved base location exists → suppress, EXCEPT a one-per-launch "allow your
 *   location?" upgrade ask when device location services are on AND the OS still
 *   allows a prompt. Services off / hard-denied → stay silent (use the saved location).
 * - No saved location → prompt at most once per launch, regardless of canAskAgain
 *   (re-asking hard-denied users still lets them reach "Select location manually";
 *   LocationPermissionScreen adapts its CTA to "Open settings" when canAskAgain is false).
 */
export function resolvePromptState(
  status: Location.PermissionStatus,
  canAskAgain: boolean,
  shownThisSession: boolean,
  hasSavedLocation: boolean,
  servicesEnabled: boolean
): LocationPromptState {
  if (status === Location.PermissionStatus.GRANTED) return 'done';

  if (hasSavedLocation) {
    if (servicesEnabled && canAskAgain && !shownThisSession) return 'show';
    return 'done';
  }

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

  useEffect(() => {
    async function check() {
      try {
        const [{ status, canAskAgain }, base, servicesEnabled, setupComplete] = await Promise.all([
          Location.getForegroundPermissionsAsync(),
          getBaseLocation(),
          Location.hasServicesEnabledAsync(),
          getLocationSetupComplete(),
        ]);
        // The standalone onboarding location step is now the primary path. Once a
        // user has been through it, never show the lazy map prompt. The rest of the
        // logic stays as a defensive fallback (e.g. guest sessions, missing flag,
        // permission revoked later).
        if (setupComplete) {
          setPromptState('done');
          return;
        }
        setPromptState(
          resolvePromptState(status, canAskAgain, shownThisSession, base !== null, servicesEnabled)
        );
      } catch {
        // Location checks failed (permission or services read) → don't block the map.
        setPromptState('done');
      }
    }

    void check();
  }, []);

  const markSeen = useCallback(() => {
    shownThisSession = true;
    setPromptState('done');
    return Promise.resolve();
  }, []);

  return { promptState, markSeen };
}
