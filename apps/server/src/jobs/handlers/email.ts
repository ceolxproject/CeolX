import { sendEmail } from '@CeolX/email';

import type { JobPayload } from '../types.ts';

// Subject lines for each job template.
// TODO M7-T1: replace with React Email template rendering once the email
// template system is built. sendEmail will then receive rendered html/text
// and the subject will come from the template itself.
const SUBJECT_MAP: Record<string, string> = {
  'email-verification': 'Verify your CeolX email',
  'password-reset': 'Reset your CeolX password',
  'venue-activation': 'Activate your CeolX venue profile',
  'payment-confirmation': 'Payment confirmed — CeolX',
  'event-approved': 'Your event is live on CeolX',
  'event-rejected': 'Update required for your CeolX event',
  'booking-invitation': 'New booking invitation on CeolX',
  'booking-accepted': 'Booking accepted on CeolX',
  'booking-rejected': 'Booking update on CeolX',
  'data-export-ready': 'Your CeolX data export is ready',
};

type StubSendOptions = { to: string; subject: string; tag: string };

export async function handleEmailSend(payload: JobPayload<'email.send'>): Promise<void> {
  const { to, template } = payload;
  const subject = SUBJECT_MAP[template] ?? 'CeolX notification';
  // TODO M7-T1: switch to typed sendEmail<template>(data) once templates exist.
  await (sendEmail as unknown as (opts: StubSendOptions) => Promise<void>)({
    to,
    subject,
    tag: template,
  });
}
