/**
 * Builds the HTTPS bridge URL we put in verification emails.
 *
 * Email clients (Gmail web, Outlook, many mobile clients) strip or disable
 * custom-scheme hrefs like `ceolx://...`, so we point the email at an HTTPS
 * route on the API server. That route returns a tiny HTML page that redirects
 * to `ceolx://verify-email?token=...` (where the mobile app picks the token
 * up via expo-linking and finishes verification via BetterAuth).
 *
 * BetterAuth provides:  {BETTER_AUTH_URL}/api/auth/verify-email?token=xxx
 * This returns:         {baseUrl}/verify-email?token=xxx
 */
export function buildVerificationBridgeUrl(verificationUrl: string, baseUrl: string): string {
  const url = new URL(verificationUrl);
  const token = url.searchParams.get('token') ?? '';
  const trimmed = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  return `${trimmed}/verify-email?token=${encodeURIComponent(token)}`;
}
