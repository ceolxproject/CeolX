import { sendEmail } from '../send.js';

interface TrialEndingParams {
  to: string;
  venueName: string;
  amount: string;
  chargeDate: string;
  interval: string;
  manageUrl: string;
  userName?: string;
}

/**
 * Warn a venue 7 days before the first charge (M8-T0 D-30).
 *
 * The single most important email in the subscription flow: the trial runs six
 * months, so the charge arrives long after the venue has forgotten signing up.
 * The amount and date must come from Stripe at send time, never from a constant —
 * quoting a figure we cannot verify is what turns a renewal into a dispute.
 */
export async function sendTrialEndingEmail({
  to,
  venueName,
  amount,
  chargeDate,
  interval,
  manageUrl,
  userName = '',
}: TrialEndingParams): Promise<void> {
  await sendEmail({
    to,
    template: 'trial-ending',
    data: { userName, venueName, amount, chargeDate, interval, manageUrl },
  });
}
