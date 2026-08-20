/**
 * Where an incoming link should actually open.
 *
 * Shared event links are minted as `/event/<id>` (see hooks/use-share-event),
 * but the screen people expect lives inside the discover tab, so the tab bar is
 * there and back reaches the feed. Rewriting the path before Expo Router builds
 * a state is what keeps that landing honest: a route that forwards itself once
 * mounted leaves the screen it forwarded from sitting in the stack, and
 * `router.navigate` pushes a second tabs entry rather than reusing the one
 * already below it — so back bounces between the feed and the event forever.
 *
 * Pure and free of react-native imports so it can be tested directly; the
 * `+native-intent` module and the launch-URL guard both route through here so a
 * link lands in the same place however it arrives.
 */

function normalize(path: string): string {
  const withLeading = path.startsWith('/') ? path : `/${path}`;
  return withLeading.length > 1 && withLeading.endsWith('/')
    ? withLeading.slice(0, -1)
    : withLeading;
}

/**
 * Splits a link into the path to compare and the href to navigate to.
 *
 * The two shapes CeolX receives put their first segment in different places:
 * `https://api.ceolx.com/event/<id>` carries a real host to discard, while
 * `ceolx://event/<id>` has `event` sitting where the host would be. Query
 * strings stay on the href but off the path, since the router reports a
 * pathname without them. Returns null for anything that names no screen.
 */
export function extractLinkTarget(url: string): { path: string; href: string } | null {
  const match = /^([a-zA-Z][a-zA-Z0-9+.-]*):\/\/([^?#]*)(\?[^#]*)?/.exec(url);

  // Already a bare path — expo-router hands these through unchanged.
  if (!match) {
    if (!url.startsWith('/')) return null;
    const [rawPath = '', rawQuery = ''] = url.split(/(?=\?)/);
    const path = normalize(rawPath);
    return path === '/' ? null : { path, href: `${path}${rawQuery}` };
  }

  const scheme = match[1].toLowerCase();
  const query = match[3] ?? '';
  let rest = match[2] ?? '';

  if (scheme === 'http' || scheme === 'https') {
    const firstSlash = rest.indexOf('/');
    rest = firstSlash === -1 ? '' : rest.slice(firstSlash + 1);
  }

  const path = normalize(rest.replace(/^\/+/, ''));
  // A bare scheme (`ceolx://`) names no screen — there is nothing to open.
  if (path === '/') return null;

  return { path, href: `${path}${query}` };
}

/** `/event/<id>` — the shape shared links use. Ids are uuids, never a slash. */
const SHARED_EVENT_PATH = /^\/event\/([^/]+)$/;

/**
 * Rewrites a link onto the route that owns the screen, leaving anything else
 * untouched. Takes the raw link (full URL or bare path) and returns the same
 * kind of value, so it can sit directly in `redirectSystemPath`.
 */
export function redirectSharedPath(url: string): string {
  const target = extractLinkTarget(url);
  if (!target) return url;

  const eventMatch = SHARED_EVENT_PATH.exec(target.path);
  if (!eventMatch) return url;

  // `(app)` and `(tabs)` are groups and carry no URL segment of their own.
  const query = target.href.slice(target.path.length);
  return `/discover/event/${eventMatch[1]}${query}`;
}
