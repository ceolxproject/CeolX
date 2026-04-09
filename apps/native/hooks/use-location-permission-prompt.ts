import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'locationPermissionAsked';

/** Three states to avoid a flash of the map before storage resolves. */
export type LocationPromptState = 'checking' | 'show' | 'done';

type Result = {
  promptState: LocationPromptState;
  /** Call after the user responds to the permission priming screen. */
  markSeen: () => Promise<void>;
};

/**
 * Determines whether to show the location permission priming screen.
 *
 * - 'checking' → storage read in progress; render nothing
 * - 'show'     → first visit, permission undetermined → show LocationPermissionScreen
 * - 'done'     → already seen, or permission already decided → skip straight to map
 */
export function useLocationPermissionPrompt(): Result {
  const [promptState, setPromptState] = useState<LocationPromptState>('checking');

  useEffect(() => {
    async function check() {
      try {
        const hasSeen = await SecureStore.getItemAsync(STORAGE_KEY);
        if (hasSeen) {
          setPromptState('done');
          return;
        }

        // If the user already has a permission decision (re-install scenario
        // where OS permission persists but SecureStore was cleared), skip the
        // priming screen — no point asking again.
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== Location.PermissionStatus.UNDETERMINED) {
          await SecureStore.setItemAsync(STORAGE_KEY, '1');
          setPromptState('done');
          return;
        }

        setPromptState('show');
      } catch {
        // Storage failure → skip priming screen, don't block the map
        setPromptState('done');
      }
    }

    void check();
  }, []);

  const markSeen = useCallback(async () => {
    try {
      await SecureStore.setItemAsync(STORAGE_KEY, '1');
    } catch {
      // Non-fatal — worst case the prompt shows again next launch
    }
    setPromptState('done');
  }, []);

  return { promptState, markSeen };
}
