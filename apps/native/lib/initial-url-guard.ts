import { extractLinkTarget, redirectSharedPath } from '@/lib/deep-link-routes';

/**
 * Decides whether a launch URL still needs to be opened by hand.
 *
 * Android can hand the app a fresh intent on a launch path that has no
 * onNewIntent — a new Activity over a JS process that never died. On that path
 * expo-router restores the navigation state it kept in module scope and gives
 * it priority over the state it computed from the launch URL, so the URL is
 * dropped and the app opens on whatever it was showing last. The URL it
 * discarded is still readable through Linking.getInitialURL(), which is what
 * this compares against where the router actually landed.
 *
 * Kept pure and free of react-native imports so the decision is testable on its
 * own; the hook supplies the values.
 */
export type InitialUrlDecision =
  | { action: 'ignore'; reason: 'no-url' | 'unparsable' | 'already-applied' }
  | { action: 'navigate'; href: string };

function normalize(path: string): string {
  const withLeading = path.startsWith('/') ? path : `/${path}`;
  return withLeading.length > 1 && withLeading.endsWith('/')
    ? withLeading.slice(0, -1)
    : withLeading;
}

/**
 * True when the router has already landed on the link. An exact match is the
 * common case; the suffix check covers a link that resolves somewhere deeper,
 * where `/event/<id>` legitimately opens as `/discover/event/<id>`. Both paths
 * start at a segment boundary, so this cannot match a partial id.
 */
function alreadyShowing(linkPath: string, currentPath: string): boolean {
  const current = normalize(currentPath);
  return current === linkPath || current.endsWith(linkPath);
}

export function decideInitialUrl(params: {
  /** Raw launch URL, null when the app was not opened from one. */
  initialUrl: string | null;
  /** Where the router is right now. */
  currentPath: string;
}): InitialUrlDecision {
  const { initialUrl, currentPath } = params;

  if (!initialUrl) return { action: 'ignore', reason: 'no-url' };

  const target = extractLinkTarget(initialUrl);
  if (!target) return { action: 'ignore', reason: 'unparsable' };

  // Compare against where the link actually opens, not the address it was
  // shared as, so a rewritten link isn't mistaken for one that never arrived.
  const resolved = extractLinkTarget(redirectSharedPath(initialUrl)) ?? target;

  if (alreadyShowing(target.path, currentPath) || alreadyShowing(resolved.path, currentPath)) {
    return { action: 'ignore', reason: 'already-applied' };
  }

  return { action: 'navigate', href: resolved.href };
}
