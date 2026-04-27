import { sendEmail } from '../send.js';

/**
 * Dispatch the password-reset template. Called from the Better Auth
 * `sendResetPassword` hook on forgot-password requests.
 */
export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
  userName = ''
): Promise<void> {
  await sendEmail({
    to,
    template: 'password-reset',
    data: { userName, resetUrl },
  });
}
