import { redirectSharedPath } from '@/lib/deep-link-routes';

/**
 * Rewrites incoming links before Expo Router turns them into a navigation
 * state. Runs for both the URL an app launch carries and the ones delivered to
 * a running app, so a shared event link opens inside the discover tab either
 * way — see lib/deep-link-routes for why this happens here rather than in a
 * screen that forwards itself.
 *
 * Expo Router documents that throwing here can crash the app, so nothing is
 * allowed to escape: an unrecognised link is simply left alone.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    return redirectSharedPath(path);
  } catch {
    return path;
  }
}
