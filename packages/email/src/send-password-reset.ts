import { sendEmail } from './send.js';

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
