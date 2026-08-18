import { sendEmail } from '../send.js';

interface ManageSubscriptionParams {
  to: string;
  venueName: string;
  portalUrl: string;
  userName?: string;
}

/**
 * Email a Stripe Customer Portal link (M8-T0 D-45).
 *
 * Emailed rather than opened in the app for the same reason as activation (D-16):
 * no billing URL may appear in the app on either store. Not queueable — a portal
 * session URL is a bearer credential for someone's billing account, and a queued
 * payload would park it in a third-party message store.
 */
export async function sendManageSubscriptionEmail({
  to,
  venueName,
  portalUrl,
  userName = '',
}: ManageSubscriptionParams): Promise<void> {
  await sendEmail({
    to,
    template: 'manage-subscription',
    data: { userName, venueName, portalUrl },
  });
}
