import { sendEmail } from '../send.js';

/**
 * Dispatch the onboarding welcome template (ONB-01). Called once per new
 * account from the Better Auth session-created hook (packages/auth login-hook),
 * the first time a user reaches an authenticated session. Direct-send (not
 * queued) — mirrors verification / password-reset, which also originate in the
 * auth layer.
 */
export async function sendWelcomeEmail(to: string, ctaUrl: string, userName = ''): Promise<void> {
  await sendEmail({
    to,
    template: 'welcome',
    data: { userName, ctaUrl },
  });
}
