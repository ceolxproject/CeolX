import { sendEmail } from '../send.js';

interface ActivationReminderParams {
  to: string;
  venueName: string;
  monthlyUrl: string;
  annualUrl: string;
  monthlyPrice?: string;
  annualPrice?: string;
  expiresInMinutes: number;
  userName?: string;
}

/**
 * Nudge a venue who signed up but never activated (M8-T0 D-26).
 *
 * Like the original activation email, this is NOT queueable through `email.send`:
 * it carries a live activation token, and a queued payload would leave that
 * credential in Upstash's message store. The reminder job mints the token and
 * calls this directly in the same process.
 */
export async function sendActivationReminderEmail({
  to,
  venueName,
  monthlyUrl,
  annualUrl,
  monthlyPrice,
  annualPrice,
  expiresInMinutes,
  userName = '',
}: ActivationReminderParams): Promise<void> {
  await sendEmail({
    to,
    template: 'activation-reminder',
    data: {
      userName,
      venueName,
      monthlyUrl,
      annualUrl,
      monthlyPrice,
      annualPrice,
      expiresInMinutes,
    },
  });
}
