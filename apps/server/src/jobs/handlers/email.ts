import {
  type EmailTemplate,
  sendEventApprovedEmail,
  sendEventRejectedEmail,
  sendNotificationEmail,
  sendPasswordResetEmail,
  sendPaymentConfirmationEmail,
  sendVenueActivationEmail,
  sendVerificationEmail,
} from '@CeolX/email';

import type { JobPayload } from '../types.ts';

/**
 * Route each `email.send` job payload to the typed sender in `@CeolX/email`.
 * The job schema's `data` field is a flat `Record<string, string>`, so each
 * entry extracts the fields its sender needs. Missing fields fall back to
 * empty strings — the template renderer applies its own "Hi there" fallback.
 */
type Dispatch = (to: string, data: Record<string, string>) => Promise<void>;

const dispatchers: Record<EmailTemplate, Dispatch> = {
  verification: (to, d) => sendVerificationEmail(to, d.verificationUrl ?? '', d.userName),
  'password-reset': (to, d) => sendPasswordResetEmail(to, d.resetUrl ?? '', d.userName),
  'venue-activation': (to, d) =>
    sendVenueActivationEmail({
      to,
      venueName: d.venueName ?? '',
      activationUrl: d.activationUrl ?? '',
      userName: d.userName,
    }),
  'payment-confirmation': (to, d) =>
    sendPaymentConfirmationEmail({
      to,
      amount: d.amount ?? '',
      planName: d.planName ?? '',
      nextBillingDate: d.nextBillingDate ?? '',
      manageUrl: d.manageUrl ?? '',
      userName: d.userName,
      invoiceUrl: d.invoiceUrl,
    }),
  'event-approved': (to, d) =>
    sendEventApprovedEmail({
      to,
      eventTitle: d.eventTitle ?? '',
      eventUrl: d.eventUrl ?? '',
      userName: d.userName,
      eventDate: d.eventDate,
    }),
  'event-rejected': (to, d) =>
    sendEventRejectedEmail({
      to,
      eventTitle: d.eventTitle ?? '',
      reason: d.reason ?? '',
      editUrl: d.editUrl ?? '',
      userName: d.userName,
    }),
  notification: (to, d) =>
    sendNotificationEmail({
      to,
      subject: d.subject ?? '',
      body: d.body ?? '',
      ctaUrl: d.ctaUrl ?? '',
      userName: d.userName,
    }),
};

export async function handleEmailSend(payload: JobPayload<'email.send'>): Promise<void> {
  const { to, template, data = {} } = payload;
  await dispatchers[template](to, data);
}
