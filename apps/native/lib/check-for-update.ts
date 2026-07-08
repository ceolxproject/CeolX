import * as Linking from 'expo-linking';
import * as Updates from 'expo-updates';

const TIMEOUT_MS = 3000;
const MANUAL_TIMEOUT_MS = 20_000;

export type RunningBundleInfo =
  | { source: 'embedded' }
  | { source: 'ota'; updateId: string; createdAt: Date | null };

// Reports the JS bundle actually executing right now. `isEmbeddedLaunch` is true
// when the binary is running its baked-in bundle; once `applyPendingUpdate` or
// `checkForUpdateManually` swaps in an OTA, subsequent launches return
// `updateId` + `createdAt` from the manifest. Used by the About screen so QA can
// tell a fresh install from a binary that OTAed up.
export function getRunningBundleInfo(): RunningBundleInfo {
  if (Updates.isEmbeddedLaunch || !Updates.updateId) {
    return { source: 'embedded' };
  }
  return {
    source: 'ota',
    updateId: Updates.updateId,
    createdAt: Updates.createdAt,
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('ota_timeout')), ms)),
  ]);
}

/**
 * Polls EAS Update on cold start and applies a pending bundle. Without this, the
 * default `checkAutomatically: "ON_LOAD"` downloads in the background but only
 * swaps in the bundle on the *next* cold launch — iOS keeps the process alive
 * for days, so users could go a week without a published fix.
 *
 * Budget: ~6s total (3s check + 3s fetch). On timeout / no update / any error,
 * falls through and lets the embedded bundle boot; default polling retries next
 * launch.
 *
 * CeolX-specific: a `reloadAsync()` mid cold-start would restart the process
 * while Expo Router is restoring a deep link, dropping it (Asana
 * 1215040939202673). So when the app was launched from a link
 * (`Linking.getInitialURL()` non-null), we stage the update but skip the reload
 * — it applies on the next launch instead.
 *
 * Returns true only if `reloadAsync()` is about to fire — callers should not
 * rely on this value since the process restarts before it resolves.
 */
export async function applyPendingUpdate(): Promise<boolean> {
  if (__DEV__ || !Updates.isEnabled) return false;
  try {
    const check = await withTimeout(Updates.checkForUpdateAsync(), TIMEOUT_MS);
    if (!check.isAvailable) return false;
    await withTimeout(Updates.fetchUpdateAsync(), TIMEOUT_MS);
    // Don't interrupt a cold-start deep-link launch with a reload.
    const initialUrl = await Linking.getInitialURL();
    if (initialUrl) return false;
    await Updates.reloadAsync();
    return true;
  } catch {
    return false;
  }
}

export type ManualUpdateResult =
  | { status: 'disabled' }
  | { status: 'up_to_date' }
  | { status: 'applied' }
  | { status: 'error'; message: string };

/**
 * User-initiated update check from the About screen. Differs from the cold-start
 * `applyPendingUpdate` in three ways: (1) the timeout budget is 20s per phase
 * since the user is actively waiting and would rather see a slow success than a
 * fast silent failure, (2) errors surface as an explicit result variant instead
 * of being swallowed, and (3) on `applied` the update is staged but the process
 * is NOT restarted here — the caller shows a confirmation dialog and triggers
 * `reloadAsync()` only after the user opts in.
 */
export async function checkForUpdateManually(): Promise<ManualUpdateResult> {
  if (__DEV__ || !Updates.isEnabled) return { status: 'disabled' };
  try {
    const check = await withTimeout(Updates.checkForUpdateAsync(), MANUAL_TIMEOUT_MS);
    if (!check.isAvailable) return { status: 'up_to_date' };
    await withTimeout(Updates.fetchUpdateAsync(), MANUAL_TIMEOUT_MS);
    return { status: 'applied' };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'unknown_error',
    };
  }
}
