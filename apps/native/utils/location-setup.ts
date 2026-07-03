import * as SecureStore from 'expo-secure-store';

/**
 * Whether a SPECIFIC user has been through the standalone "Set your location"
 * onboarding step (granted GPS or picked a place). This — not the presence of a
 * base location — gates completion: granting GPS resolves a live fix without ever
 * writing a base location, yet the step is still complete.
 *
 * Keyed PER USER (`${PREFIX}.${userId}`). The keychain/SecureStore is a device
 * singleton, so a single global key let one account's completion suppress the
 * step for every later account on the same device (and across iOS reinstalls,
 * which preserve the keychain) — a brand-new user would skip location priming
 * and drop straight to the IP fallback. Namespacing by user id keeps each
 * account's completion independent.
 *
 * Survives cold starts so the step shows once per account. On iOS the keychain
 * often survives reinstalls (that account's step stays complete — acceptable,
 * already configured); Android clears on uninstall (step re-runs).
 */
const PREFIX = 'ceolx.location-setup-complete';

const keyFor = (userId: string) => `${PREFIX}.${userId}`;

/** Returns true only when the flag is explicitly set for `userId`; never throws. */
export async function getLocationSetupComplete(userId: string): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(keyFor(userId))) === '1';
  } catch {
    return false;
  }
}

export async function setLocationSetupComplete(userId: string): Promise<void> {
  await SecureStore.setItemAsync(keyFor(userId), '1');
}

/** Clears the flag for `userId` (test/dev helper — the step will show again). */
export async function clearLocationSetupComplete(userId: string): Promise<void> {
  await SecureStore.deleteItemAsync(keyFor(userId));
}
