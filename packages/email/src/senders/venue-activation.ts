import { sendEmail } from '../send.js';

interface VenueActivationParams {
  to: string;
  venueName: string;
  activationUrl: string;
  userName?: string;
}

/**
 * Dispatch the venue-activation template. Fires after a user completes the
 * `createVenueProfile` onboarding mutation — the profile is created in
 * `subscription_status = inactive` until the Stripe webhook activates it.
 *
 * The email is the only in-product surface that carries the
 * `ceolx.ie/subscribe` URL — per M7-T3 R4.3, that link never appears in the
 * mobile app UI (Apple Rule 3.1.1 compliance).
 */
export async function sendVenueActivationEmail({
  to,
  venueName,
  activationUrl,
  userName = '',
}: VenueActivationParams): Promise<void> {
  await sendEmail({
    to,
    template: 'venue-activation',
    data: { userName, venueName, activationUrl },
  });
}
