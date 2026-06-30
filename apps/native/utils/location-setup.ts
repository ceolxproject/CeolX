import * as SecureStore from 'expo-secure-store';

/**
 * Whether the user has been through the standalone "Set your location"
 * onboarding step (granted GPS or picked a place). This — not the presence of a
 * base location — gates completion: granting GPS resolves a live fix without ever
 * writing a base location, yet the step is still complete.
 *
 * Survives cold starts so the step shows once. On iOS the keychain often survives
 * reinstalls (step stays complete — acceptable, already configured); Android
 * clears on uninstall (step re-runs).
 */
const KEY = 'ceolx.location-setup-complete';

/** Returns true only when the flag is explicitly set; never throws. */
export async function getLocationSetupComplete(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(KEY)) === '1';
  } catch {
    return false;
  }
}

export async function setLocationSetupComplete(): Promise<void> {
  await SecureStore.setItemAsync(KEY, '1');
}

/** Clears the flag (test/dev helper — the onboarding step will show again). */
export async function clearLocationSetupComplete(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}
