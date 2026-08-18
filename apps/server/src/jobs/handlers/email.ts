import {
  sendEventApprovedEmail,
  sendEventRejectedEmail,
  sendNotificationEmail,
  sendPasswordResetEmail,
  sendPaymentConfirmationEmail,
  sendVerificationEmail,
} from '@CeolX/email';

import type { JobPayload, QueueableEmailTemplate } from '../types.ts';

/**
 * Route each `email.send` job payload to the typed sender in `@CeolX/email`.
 * The job schema's `data` field is a flat `Record<string, string>`, so each
 * entry extracts the fields its sender needs. Missing fields fall back to
 * empty strings — the template renderer applies its own "Hi there" fallback.
 */
type Dispatch = (to: string, data: Record<string, string>) => Promise<void>;

const dispatchers: Record<QueueableEmailTemplate, Dispatch> = {
  verification: (to, d) => sendVerificationEmail(to, d.verificationUrl ?? '', d.userName),
  'password-reset': (to, d) => sendPasswordResetEmail(to, d.resetUrl ?? '', d.userName),
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

  // Explicit lookup rather than calling straight through. This payload arrives as
  // JSON over the QStash webhook, so `template` is untrusted at runtime however
  // well-typed it is at compile time. An unknown key would otherwise fail as
  // "dispatchers[template] is not a function", which says nothing useful in a log
  // and looks like a bug in the handler rather than a bad payload.
  //
  // It also matters for the deliberately non-queueable templates: 'venue-activation'
  // must never be dispatched from here, because a queued payload would park a live
  // activation token in Upstash's message store (M8-T1).
  const dispatch = dispatchers[template];
  if (!dispatch) {
    throw new Error(`email.send: unknown or non-queueable template "${template}"`);
  }

  await dispatch(to, data);
}
