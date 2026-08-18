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
  // 'venue-activation' is deliberately NOT queueable: publishJob posts the full
  // payload to Upstash, which would leave a live activation token (a credential)
  // in a third-party message store. venues.requestActivation sends it directly.
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

/**
 * Activation reminder (M8-T0 D-26: 24 h, 3 days, 7 days after sign-up).
 *
 * Carries the user id ONLY — never a token or a URL. The handler mints a fresh
 * token at send time, because by 3 days the original has long expired (D-17), and
 * because a queued payload containing a live credential would sit in Upstash's
 * message store for its retention window.
 *
 * `attempt` exists so a log line can say which of the three this was.
 */
export const subscriptionActivationReminderSchema = z.object({
  userId: z.string().min(1),
  attempt: z.union([z.literal(1), z.literal(2), z.literal(3)]),
});

/**
 * Trial-ending warning (D-30), scheduled 7 days before the first charge.
 *
 * Carries the venue id only. Everything else — the amount, the date, whether the
 * venue has since cancelled — is re-read at send time, because the job is queued
 * up to six months in advance and any value captured now may be stale by then.
 */
export const subscriptionTrialEndingSchema = z.object({
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
  | 'subscription.activation-reminder'
  | 'subscription.trial-ending'
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
  'subscription.activation-reminder': subscriptionActivationReminderSchema,
  'subscription.trial-ending': subscriptionTrialEndingSchema,
  'data-export.process': dataExportProcessSchema,
  'data-export.notify': dataExportNotifySchema,
} as const;

export type JobPayload<T extends JobType> = z.infer<(typeof jobPayloadSchemas)[T]>;
