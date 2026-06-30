import { z } from 'zod';

import type { EmailTemplate } from '@CeolX/email';

// ---------------------------------------------------------------------------
// Payload schemas — one per job type
// ---------------------------------------------------------------------------

// The subset of `EmailTemplate` (from `@CeolX/email`) dispatched via the
// `email.send` job queue. The `satisfies` clause is a compile-time check that
// every entry is a real template key. Direct-send-only templates
// (`collaborator-invite`, `account-deleted`) are intentionally absent — they
// are sent by a direct sender call at their event source, never queued.
const EMAIL_TEMPLATES = [
  'verification',
  'password-reset',
  'venue-activation',
  'payment-confirmation',
  'event-approved',
  'event-rejected',
  'notification',
] as const satisfies readonly EmailTemplate[];

/** Templates dispatched through the `email.send` job queue (see `handlers/email.ts`). */
export type QueueableEmailTemplate = (typeof EMAIL_TEMPLATES)[number];

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

export const accountFlagInactiveSchema = z.object({});

export const accountAnonymizeSweepSchema = z.object({});

export const ipAnonymizeSchema = z.object({
  olderThanDays: z.number().int().positive().default(30),
});

// Per-user push job (mentor pattern §3 hybrid). The dispatcher publishes one
// of these per recipient; the handler fetches active tokens and calls
// messaging.sendEach for batched fan-out. Replaces the previous per-token
// payload — turns N device-token jobs into 1 user job.
export const notificationPushSchema = z.object({
  userId: z.string(),
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
  | 'account.flag-inactive'
  | 'account.anonymize-sweep'
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
  'account.flag-inactive': accountFlagInactiveSchema,
  'account.anonymize-sweep': accountAnonymizeSweepSchema,
  'ip.anonymize': ipAnonymizeSchema,
  'notification.push': notificationPushSchema,
  'notification.batch': notificationBatchSchema,
  'venue.subscription-retry': venueSubscriptionRetrySchema,
  'data-export.process': dataExportProcessSchema,
  'data-export.notify': dataExportNotifySchema,
} as const;

export type JobPayload<T extends JobType> = z.infer<(typeof jobPayloadSchemas)[T]>;
