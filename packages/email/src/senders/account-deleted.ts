import { sendEmail } from '../send.js';

interface AccountDeletedParams {
  to: string;
  userName?: string;
}

/**
 * Dispatch the account-deleted confirmation (matrix S-06 / A-18 / V-17). Called
 * directly by the GDPR anonymisation handler with the account's original email,
 * captured before erasure overwrites it. Email-only — never queued.
 */
export async function sendAccountDeletedEmail({
  to,
  userName = '',
}: AccountDeletedParams): Promise<void> {
  await sendEmail({
    to,
    template: 'account-deleted',
    data: { userName },
  });
}
