import { sendEmail } from '../send.js';

/**
 * Dispatch the email-verification template. Called from the Better Auth
 * `sendVerificationEmail` hook on sign-up.
 */
export async function sendVerificationEmail(
  to: string,
  verificationUrl: string,
  userName = ''
): Promise<void> {
  await sendEmail({
    to,
    template: 'verification',
    data: { userName, verificationUrl },
  });
}
