import { sendEmail } from '@CeolX/email';

import type { JobPayload } from '../types.ts';

// Template → subject mapping. Expand as HTML templates are built.
const SUBJECT_MAP: Record<string, string> = {
  'email-verification': 'Verify your CeolX email',
  'password-reset': 'Reset your CeolX password',
  'venue-activation': 'Activate your CeolX venue profile',
  'payment-confirmation': 'CeolX payment confirmed',
  'event-approved': 'Your event is live on CeolX',
  'event-rejected': 'Your CeolX event needs changes',
  'booking-invitation': 'New booking invitation on CeolX',
  'booking-accepted': 'Booking accepted on CeolX',
  'booking-rejected': 'Booking update on CeolX',
  'data-export-ready': 'Your CeolX data export is ready',
};

// TODO: replace stub HTML/text bodies with rendered templates when the email
// template system is built (likely a React Email integration in M7).
export async function handleEmailSend(payload: JobPayload<'email.send'>): Promise<void> {
  const subject = SUBJECT_MAP[payload.template] ?? 'CeolX notification';

  await sendEmail({
    to: payload.to,
    subject,
    htmlBody: `<p>Template: ${payload.template}</p>`,
    textBody: `Template: ${payload.template}`,
    tag: payload.template,
  });
}
