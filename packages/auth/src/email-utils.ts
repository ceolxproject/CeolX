/**
 * Builds the HTTPS "deep-link bridge" URLs we put in transactional emails.
 *
 * Email clients (Gmail web, Outlook, many mobile clients) strip or disable
 * custom-scheme hrefs like `ceolx://...`, so we point emails at an HTTPS route
 * on the API server. That route returns a tiny HTML page that redirects to
 * `ceolx://<path>?token=...` (where the mobile app picks the token up via
 * expo-linking and finishes the flow via BetterAuth).
 */

/**
 * Build an HTTPS bridge URL for any flow, given the app path and a raw token.
 *
 * Returns: `{baseUrl}/<path>?token=<token>`
 */
export function buildDeepLinkBridgeUrl(path: string, token: string, baseUrl: string): string {
  const trimmed = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  return `${trimmed}/${path}?token=${encodeURIComponent(token)}`;
}

/**
 * Build the verification bridge URL from a full BetterAuth verification URL.
 *
 * BetterAuth provides:  {BETTER_AUTH_URL}/api/auth/verify-email?token=xxx
 * This returns:         {baseUrl}/verify-email?token=xxx
 */
export function buildVerificationBridgeUrl(verificationUrl: string, baseUrl: string): string {
  const url = new URL(verificationUrl);
  const token = url.searchParams.get('token') ?? '';
  return buildDeepLinkBridgeUrl('verify-email', token, baseUrl);
}
