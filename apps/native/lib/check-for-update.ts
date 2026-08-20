import * as Linking from 'expo-linking';
import * as Updates from 'expo-updates';

// Cold-start budgets. The check is one small manifest request, so it stays
// tight — its only job is to answer "is there an update?" before the splash
// lifts. The fetch is the actual bundle download, and 3s (the old shared
// budget) was the bug: a few-MB bundle on mobile data routinely takes longer,
// so the first cold start timed out, staged the download in the background,
// and only the SECOND cold start ran the new bundle. QA reads that as "OTA
// doesn't apply when I close and reopen the app." The root layout holds the
// brand splash until this resolves, so the fetch budget is only ever felt when
// an update genuinely exists and is downloading — never on the common path.
const CHECK_TIMEOUT_MS = 5_000;
const FETCH_TIMEOUT_MS = 15_000;
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
 * Budget: 5s check + 15s fetch, worst case ~20s of splash — and only when an
 * update exists and is still downloading. On timeout / no update / any error,
 * falls through and boots the current bundle; a timed-out fetch keeps
 * downloading in the background, so the update is staged and expo-updates
 * launches it natively on the next cold start. Offline launches fail the check
 * fast and boot normally — the app must never refuse to open without network.
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
    const check = await withTimeout(Updates.checkForUpdateAsync(), CHECK_TIMEOUT_MS);
    if (!check.isAvailable) return false;
    await withTimeout(Updates.fetchUpdateAsync(), FETCH_TIMEOUT_MS);
    // Don't interrupt a cold-start deep-link launch with a reload.
    const initialUrl = await Linking.getInitialURL();
    if (initialUrl) return false;
    await Updates.reloadAsync();
    return true;
  } catch {
    return false;
  }
}

/**
 * How long the app must have been backgrounded before a resume is allowed to
 * restart it. The threshold is the whole safety mechanism, not a tuning knob:
 * verify-email and forgot-password deliberately send people to their mail app
 * and back, and event creation is a multi-step form. Restarting on a short
 * round trip would break the flow the user is standing in. Fifteen minutes is
 * long enough that the session is realistically over, short enough that
 * "opened it again after lunch" still picks up the update.
 */
export const RESUME_UPDATE_THRESHOLD_MS = 15 * 60 * 1000;

/**
 * How recently a deep link must have arrived for a resume to leave the app
 * alone. Tapping a shared link is itself a resume, and reloading the process
 * to apply an update throws away the URL that just came in — the user watches
 * the app restart onto whatever it was showing before. The update applies on
 * the next resume instead, when nothing is riding on the current launch.
 */
export const DEEP_LINK_RELOAD_GRACE_MS = 10_000;

/**
 * Pure so the threshold is testable without faking AppState. `backgroundedAt`
 * is null when the app has not been backgrounded since launch — a cold start
 * that never left the foreground must not qualify, because `applyPendingUpdate`
 * has already had its turn. `lastDeepLinkAt` is null when no link has arrived
 * this process.
 */
export function shouldApplyOnResume(
  backgroundedAt: number | null,
  now: number,
  lastDeepLinkAt: number | null = null
): boolean {
  if (backgroundedAt === null) return false;
  if (lastDeepLinkAt !== null && now - lastDeepLinkAt < DEEP_LINK_RELOAD_GRACE_MS) return false;
  return now - backgroundedAt >= RESUME_UPDATE_THRESHOLD_MS;
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
