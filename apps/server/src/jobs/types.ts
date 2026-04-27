import { z } from 'zod';

import type { EmailTemplate } from '@CeolX/email';

// ---------------------------------------------------------------------------
// Payload schemas — one per job type
// ---------------------------------------------------------------------------

// Mirror of `EmailTemplate` from `@CeolX/email`. The `satisfies` clause is a
// compile-time check — adding a template to the email package without adding
// it here will fail `tsc -b`. Templates the email package doesn't ship yet
// (booking, GDPR, etc.) are intentionally absent.
const EMAIL_TEMPLATES = [
  'verification',
  'password-reset',
  'venue-activation',
  'payment-confirmation',
  'event-approved',
  'event-rejected',
] as const satisfies readonly EmailTemplate[];

export const emailSendSchema = z.object({
  to: z.email(),
  template: z.enum(EMAIL_TEMPLATES),
  locale: z.string().default('en'),
  data: z.record(z.string(), z.string()).optional(),
});

export const accountAnonymizeSchema = z.object({
  userId: z.uuid(),
  requestedAt: z.iso.datetime(),
});

export const accountCleanupSchema = z.object({
  userId: z.uuid(),
});

export const ipAnonymizeSchema = z.object({
  olderThanDays: z.number().int().positive().default(30),
});

export const notificationPushSchema = z.object({
  deviceToken: z.string(),
  title: z.string(),
  body: z.string(),
  persona: z.enum(['spectator', 'artist', 'venue']),
  route: z.string(),
  data: z.record(z.string(), z.string()).optional(),
});

export const notificationBatchSchema = z.object({});

export const venueSubscriptionRetrySchema = z.object({
  stripeEventId: z.string(),
  venueId: z.uuid(),
});

export const dataExportProcessSchema = z.object({
  userId: z.uuid(),
  requestId: z.uuid(),
});

export const dataExportNotifySchema = z.object({
  userId: z.uuid(),
  downloadUrl: z.url(),
  expiresAt: z.iso.datetime(),
});

// ---------------------------------------------------------------------------
// Job type union and schema map
// ---------------------------------------------------------------------------

export type JobType =
  | 'email.send'
  | 'account.anonymize'
  | 'account.cleanup'
  | 'ip.anonymize'
  | 'notification.push'
  | 'notification.batch'
  | 'venue.subscription-retry'
  | 'data-export.process'
  | 'data-export.notify';

export const jobPayloadSchemas = {
  'email.send': emailSendSchema,
  'account.anonymize': accountAnonymizeSchema,
  'account.cleanup': accountCleanupSchema,
  'ip.anonymize': ipAnonymizeSchema,
  'notification.push': notificationPushSchema,
  'notification.batch': notificationBatchSchema,
  'venue.subscription-retry': venueSubscriptionRetrySchema,
  'data-export.process': dataExportProcessSchema,
  'data-export.notify': dataExportNotifySchema,
} as const;

export type JobPayload<T extends JobType> = z.infer<(typeof jobPayloadSchemas)[T]>;
