/**
 * Email-safe deep linking for notification CTAs.
 *
 * Email clients strip `ceolx://` hrefs, so notification emails point at an
 * HTTPS bridge (`{server}/r?to=<route>`) that renders a page redirecting to the
 * app's custom scheme — the same mechanism the verify-email / reset-password
 * emails use. The bridge is tokenless, so it validates the `to` route against
 * this allowlist to avoid being turned into an open redirect to arbitrary
 * app surfaces.
 */

/** Path segment of the HTTPS redirect bridge route (mounted at `/{REDIRECT_BRIDGE_PATH}`). */
export const REDIRECT_BRIDGE_PATH = 'r';

// Routes a notification CTA may legitimately deep-link to. Accept both the
// fully-qualified Expo Router path and the bare form the app remaps. Extend
// this list as more notification emails gain CTAs (e.g. event detail).
const ALLOWED_ROUTE_PATTERNS: readonly RegExp[] = [
  /^\/(?:\(app\)\/\(tabs\)\/)?bookings\/[A-Za-z0-9_-]+$/,
];

/** True when `route` is a known, safe in-app destination for an email CTA. */
export function isAllowedDeepLinkRoute(route: string): boolean {
  return ALLOWED_ROUTE_PATTERNS.some((pattern) => pattern.test(route));
}

/**
 * Build the HTTPS redirect-bridge URL for a notification CTA.
 * `baseUrl` is the server origin (e.g. `BETTER_AUTH_URL`); `route` is the
 * in-app destination, URL-encoded so the bridge receives it intact.
 */
export function buildAppRedirectUrl(baseUrl: string, route: string): string {
  const trimmed = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  return `${trimmed}/${REDIRECT_BRIDGE_PATH}?to=${encodeURIComponent(route)}`;
}
