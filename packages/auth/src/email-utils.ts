/**
 * Extracts the verification token from a BetterAuth verification URL and
 * returns a mobile deep link.
 *
 * BetterAuth generates:  https://api.ceolx.ie/api/auth/verify-email?token=xxx
 * We need:               ceolx://verify-email?token=xxx
 */
export function buildVerificationDeepLink(verificationUrl: string): string {
  const url = new URL(verificationUrl);
  const token = url.searchParams.get('token') ?? '';
  return `ceolx://verify-email?token=${token}`;
}
