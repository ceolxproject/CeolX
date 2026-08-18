import { sendEmail } from '../send.js';

interface VenueActivationParams {
  to: string;
  venueName: string;
  /** Checkout link for the monthly interval — carries ?plan=monthly. */
  monthlyUrl: string;
  /** Checkout link for the annual interval — carries ?plan=annual. */
  annualUrl: string;
  /** Formatted prices from Stripe. Omitted when Stripe could not be reached. */
  monthlyPrice?: string;
  annualPrice?: string;
  expiresInMinutes: number;
  userName?: string;
}

/**
 * Dispatch the venue-activation template — the venue's only route to payment
 * (M8-T0 D-16). No equivalent link exists anywhere in the mobile app, so a
 * failure here leaves the venue unable to subscribe at all.
 *
 * Deliberately NOT dispatched through the `email.send` QStash job, and
 * deliberately absent from the queueable template list. `publishJob` posts the
 * whole payload to Upstash for later delivery, which would leave a live
 * activation token — a credential — sitting in a third-party message store for
 * its retention window. Call this directly from the request that mints the token
 * so the token exists only in our process and the recipient's inbox.
 */
export async function sendVenueActivationEmail({
  to,
  venueName,
  monthlyUrl,
  annualUrl,
  monthlyPrice,
  annualPrice,
  expiresInMinutes,
  userName = '',
}: VenueActivationParams): Promise<void> {
  await sendEmail({
    to,
    template: 'venue-activation',
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
