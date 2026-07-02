# M1-T13 · Background Jobs — QStash Setup

| Field          | Value                                                                        |
| -------------- | ---------------------------------------------------------------------------- |
| **Milestone**  | M1 — Project Setup & Infrastructure                                          |
| **Status**     | ✅ Done                                                                      |
| **Depends on** | M1-T3 (Hono API scaffold), M1-T6 (Postmark email service)                    |
| **PRD Ref**    | Section 10.2 (Backend API — AWS Lambda), Section 7 (GDPR), Section 6 (Email) |

---

## Description

Set up Upstash QStash as the background job queue for CeolX. QStash provides serverless HTTP-based message queuing that works natively with AWS Lambda — no persistent connections, no Redis daemon, no separate worker processes. Jobs are delivered as HTTP POST requests to a webhook endpoint on the Hono API, with built-in retries, signature verification, and dead-letter queue handling.

Background jobs are required for: transactional email delivery via Postmark, GDPR account anonymisation (30-day delay after deletion request), push notification batching, and IP anonymisation.

### Why it's needed

| Use case                       | Why async is required                                                    |
| ------------------------------ | ------------------------------------------------------------------------ |
| **Email delivery** (Postmark)  | Must not block API response; needs automatic retry on transient failures |
| **GDPR account anonymisation** | Requires a 30-day delay — impossible without a queue                     |
| **IP anonymisation**           | Cron-triggered, not request-triggered                                    |
| **Push notifications** (FCM)   | Batch digest every 5 min — cron-based                                    |
| **Venue subscription retry**   | Stripe webhook failure recovery                                          |
| **GDPR data export**           | Long-running S3 upload — cannot hold an HTTP connection open             |

Lambda is stateless and ephemeral, so BullMQ + Redis is not viable. QStash is the correct fit: HTTP-native, serverless-first, built-in retry + DLQ, Upstash already in the stack (Redis rate-limiter).

### When to implement

- **Minimum viable**: before the first email trigger is wired from a tRPC router (auth — email verification, venue activation). The `packages/email` sync path works for early dev.
- **Full implementation**: before M2 — venue subscription flow and event moderation notifications both require queued delivery.

Do not implement handler logic in this task. All job handlers are stubs until M2+ features are built.

---

## Affected Apps / Packages

| App / Package     | Role                                                               |
| ----------------- | ------------------------------------------------------------------ |
| `apps/server`     | Hosts the QStash webhook receiver (`POST /api/v1/webhooks/qstash`) |
| `packages/shared` | Job type enums and payload type definitions                        |

> **Note**: The app is `apps/server`, not `apps/api`. All paths in this task under `apps/api` refer to `apps/server`.

---

## Critical Deviation — Email is Currently Synchronous

`packages/email/src/send.ts` calls Postmark **directly and synchronously** from tRPC handlers. This works for early development but must change before production:

**Current (sync — acceptable for dev only):**

```
tRPC handler → sendEmail() → Postmark
```

**Target (async — required for production):**

```
tRPC handler → publishJob('email.send', ...) → QStash → POST /api/v1/webhooks/qstash → sendEmail() → Postmark
```

**Migration rule**: When wiring real email triggers (auth verification, venue activation, etc.), call `publishJob('email.send', ...)` instead of `sendEmail()` directly. The `packages/email` package stays unchanged — it just moves to being called from the QStash job handler rather than inline.

---

## API Endpoints

### QStash Webhook Receiver

**POST /api/v1/webhooks/qstash**

Receives job payloads from QStash. Verifies the `Upstash-Signature` header before processing.

**Headers (set by QStash, verified by the receiver):**

```
Upstash-Signature: v1=...
```

**Request Body:**

```json
{
  "type": "email.send",
  "payload": {
    "to": "user@example.com",
    "template": "venue-activation",
    "data": {}
  }
}
```

**Response (200) — job processed successfully:**

```json
{ "received": true }
```

**Response (500) — job failed, QStash will retry:**

```json
{ "error": "Failed to send email", "retryable": true }
```

---

## Requirements

### Environment Variables

Add to `apps/server/.env.example` and validate in `packages/env/src/server.ts`:

```bash
# Upstash QStash credentials
QSTASH_TOKEN=                    # API token for publishing messages
QSTASH_CURRENT_SIGNING_KEY=      # Webhook signature verification
QSTASH_NEXT_SIGNING_KEY=         # Key rotation support
QSTASH_BASE_URL=                 # Public URL of the API webhook endpoint
                                 # e.g. https://api.ceolx.com/api/v1/webhooks/qstash
```

Add to `packages/env/src/server.ts` alongside existing vars:

```typescript
QSTASH_TOKEN: z.string().optional(),
QSTASH_CURRENT_SIGNING_KEY: z.string().optional(),
QSTASH_NEXT_SIGNING_KEY: z.string().optional(),
QSTASH_BASE_URL: z.string().url().optional(),
```

### Dependencies (`apps/server`)

```json
{
  "dependencies": {
    "@upstash/qstash": "^2.7.0"
  }
}
```

### Job Types

| Job Type                   | Trigger                           | Handler                                           |
| -------------------------- | --------------------------------- | ------------------------------------------------- |
| `email.send`               | Auth events, moderation results   | Send transactional email via Postmark             |
| `account.anonymize`        | 30 days after account deletion    | Anonymise personal data in Neon DB (GDPR Art. 17) |
| `account.cleanup`          | After anonymisation complete      | Remove S3 profile media, revoke active sessions   |
| `ip.anonymize`             | Cron — daily at 00:00 UTC         | Anonymise IP addresses older than 30 days in logs |
| `notification.push`        | Event moderation, booking updates | Send FCM push notification to device token        |
| `notification.batch`       | Cron — every 5 minutes            | Group and send digest notifications               |
| `venue.subscription-retry` | Stripe webhook processing failure | Retry failed subscription status update           |
| `data-export.process`      | User requests GDPR data export    | Query DB, generate JSON, upload to S3 signed URL  |
| `data-export.notify`       | Export file ready                 | Email user the S3 download link                   |

### Directory Structure (`apps/server/src/`)

```
src/
├── jobs/
│   ├── index.ts           # Barrel — exports publishJob, publishCron
│   ├── client.ts          # QStash client initialisation
│   ├── publish.ts         # Type-safe publishJob() and publishCron() functions
│   ├── verify.ts          # Webhook signature verification middleware
│   ├── types.ts           # Job type definitions and Zod payload schemas
│   └── handlers/
│       ├── index.ts       # Job router — dispatches to correct handler
│       ├── email.ts       # Handles email.send jobs (calls packages/email sendEmail())
│       ├── account.ts     # Handles account.anonymize, account.cleanup (stub — M2+)
│       ├── notification.ts # Handles notification.push, notification.batch (stub — M2+)
│       ├── ip.ts          # Handles ip.anonymize (stub — M2+)
│       ├── venue.ts       # Handles venue.subscription-retry (stub — M2+)
│       └── dataExport.ts  # Handles data-export.process, data-export.notify (stub — M2+)
└── routes/
    └── webhooks.ts        # POST /api/v1/webhooks/qstash — add to existing file
```

> `email.ts` is the only handler with real implementation in this task. All others are stubs that throw `new Error('Not implemented')`.

### `src/jobs/client.ts`

```typescript
import { Client } from '@upstash/qstash';

if (!process.env.QSTASH_TOKEN) {
  throw new Error('QSTASH_TOKEN environment variable is required');
}

export const qstashClient = new Client({
  token: process.env.QSTASH_TOKEN,
});
```

### `src/jobs/types.ts`

```typescript
import { z } from 'zod';

// --- Payload schemas ---

export const emailSendSchema = z.object({
  to: z.string().email(),
  template: z.enum([
    'email-verification',
    'password-reset',
    'venue-activation',
    'event-approved',
    'event-rejected',
    'booking-invitation',
    'booking-accepted',
    'booking-rejected',
    'data-export-ready',
  ]),
  locale: z.string().default('en'),
  data: z.record(z.string()).optional(),
});

export const accountAnonymizeSchema = z.object({
  userId: z.string().uuid(),
  requestedAt: z.string().datetime(),
});

export const accountCleanupSchema = z.object({
  userId: z.string().uuid(),
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
  data: z.record(z.string()).optional(),
});

export const notificationBatchSchema = z.object({});

export const venueSubscriptionRetrySchema = z.object({
  stripeEventId: z.string(),
  venueId: z.string().uuid(),
});

export const dataExportProcessSchema = z.object({
  userId: z.string().uuid(),
  requestId: z.string().uuid(),
});

export const dataExportNotifySchema = z.object({
  userId: z.string().uuid(),
  downloadUrl: z.string().url(),
  expiresAt: z.string().datetime(),
});

// --- Job type union ---

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
```

### `src/jobs/publish.ts`

```typescript
import { qstashClient } from './client';
import type { JobType, JobPayload } from './types';

const BASE_URL = process.env.QSTASH_BASE_URL;

export interface PublishOptions {
  delay?: string; // e.g. "30d", "5m", "1h"
  retries?: number; // default: 3
}

export async function publishJob<T extends JobType>(
  type: T,
  payload: JobPayload<T>,
  options: PublishOptions = {}
): Promise<void> {
  if (!BASE_URL) throw new Error('QSTASH_BASE_URL is not set');

  await qstashClient.publishJSON({
    url: BASE_URL,
    body: { type, payload },
    retries: options.retries ?? 3,
    delay: options.delay,
  });
}

export async function publishCron(
  type: JobType,
  schedule: string, // cron expression e.g. "*/5 * * * *"
  payload: Record<string, unknown> = {}
): Promise<void> {
  if (!BASE_URL) throw new Error('QSTASH_BASE_URL is not set');

  await qstashClient.schedules.create({
    destination: BASE_URL,
    cron: schedule,
    body: JSON.stringify({ type, payload }),
    headers: { 'Content-Type': 'application/json' },
  });
}
```

### `src/jobs/verify.ts`

```typescript
import { Receiver } from '@upstash/qstash';
import type { Context, Next } from 'hono';

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY ?? '',
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY ?? '',
});

export const verifyQStashSignature = async (c: Context, next: Next) => {
  const signature = c.req.header('Upstash-Signature');
  const body = await c.req.text();

  if (!signature) {
    return c.json({ error: 'Missing Upstash-Signature header' }, 401);
  }

  try {
    const isValid = await receiver.verify({
      signature,
      body,
      url: process.env.QSTASH_BASE_URL ?? '',
    });

    if (!isValid) {
      return c.json({ error: 'Invalid signature' }, 401);
    }
  } catch {
    return c.json({ error: 'Signature verification failed' }, 401);
  }

  // Re-parse body as JSON after text read
  c.set('rawBody', body);
  return next();
};
```

### `src/jobs/handlers/email.ts` — only handler implemented in this task

```typescript
import { sendEmail } from '@CeolX/email';
import type { JobPayload } from '../types';

// Template → subject mapping. Expand as templates are added.
const SUBJECT_MAP: Record<string, string> = {
  'email-verification': 'Verify your CeolX email',
  'password-reset': 'Reset your CeolX password',
  'venue-activation': 'Activate your CeolX venue profile',
  'event-approved': 'Your event is live on CeolX',
  'event-rejected': 'Your CeolX event needs changes',
  'booking-invitation': 'New booking invitation on CeolX',
  'booking-accepted': 'Booking accepted on CeolX',
  'booking-rejected': 'Booking update on CeolX',
  'data-export-ready': 'Your CeolX data export is ready',
};

export async function handleEmailSend(payload: JobPayload<'email.send'>): Promise<void> {
  const subject = SUBJECT_MAP[payload.template] ?? 'CeolX notification';

  // TODO: replace with rendered HTML templates when email template system is built
  await sendEmail({
    to: payload.to,
    subject,
    htmlBody: `<p>Template: ${payload.template}</p>`,
    textBody: `Template: ${payload.template}`,
    tag: payload.template,
  });
}
```

### `src/jobs/handlers/index.ts` — job router

```typescript
import { z } from 'zod';
import { jobPayloadSchemas, type JobType } from '../types';
import { handleEmailSend } from './email';
import { handleAccountAnonymize, handleAccountCleanup } from './account';
import { handleNotificationPush, handleNotificationBatch } from './notification';
import { handleIpAnonymize } from './ip';
import { handleVenueSubscriptionRetry } from './venue';
import { handleDataExportProcess, handleDataExportNotify } from './dataExport';

const handlers: Record<JobType, (payload: unknown) => Promise<void>> = {
  'email.send': async (p) => handleEmailSend(jobPayloadSchemas['email.send'].parse(p)),
  'account.anonymize': async (p) =>
    handleAccountAnonymize(jobPayloadSchemas['account.anonymize'].parse(p)),
  'account.cleanup': async (p) =>
    handleAccountCleanup(jobPayloadSchemas['account.cleanup'].parse(p)),
  'ip.anonymize': async (p) => handleIpAnonymize(jobPayloadSchemas['ip.anonymize'].parse(p)),
  'notification.push': async (p) =>
    handleNotificationPush(jobPayloadSchemas['notification.push'].parse(p)),
  'notification.batch': async (p) =>
    handleNotificationBatch(jobPayloadSchemas['notification.batch'].parse(p)),
  'venue.subscription-retry': async (p) =>
    handleVenueSubscriptionRetry(jobPayloadSchemas['venue.subscription-retry'].parse(p)),
  'data-export.process': async (p) =>
    handleDataExportProcess(jobPayloadSchemas['data-export.process'].parse(p)),
  'data-export.notify': async (p) =>
    handleDataExportNotify(jobPayloadSchemas['data-export.notify'].parse(p)),
};

const incomingSchema = z.object({
  type: z.string(),
  payload: z.unknown(),
});

export async function routeJob(rawBody: string): Promise<void> {
  const { type, payload } = incomingSchema.parse(JSON.parse(rawBody));

  const handler = handlers[type as JobType];
  if (!handler) {
    throw new Error(`Unknown job type: ${type}`);
  }

  await handler(payload);
}
```

### `src/routes/webhooks.ts` — add QStash route to existing file

The existing `webhooks.ts` has Stripe and Postmark stub routes. Add the QStash route to the same file:

```typescript
import { Hono } from 'hono';
import { verifyQStashSignature } from '../jobs/verify';
import { routeJob } from '../jobs/handlers';

const webhooksRoutes = new Hono<{ Variables: { rawBody: string } }>();

// TODO M8-T2: wire Stripe webhook handler
webhooksRoutes.post('/stripe', (c) =>
  c.json({ message: 'not implemented', route: 'POST /api/webhooks/stripe' })
);

// TODO M7: wire Postmark bounce and spam complaint handler
webhooksRoutes.post('/postmark', (c) =>
  c.json({ message: 'not implemented', route: 'POST /api/webhooks/postmark' })
);

webhooksRoutes.post('/qstash', verifyQStashSignature, async (c) => {
  const rawBody = c.get('rawBody');

  try {
    await routeJob(rawBody);
    return c.json({ received: true }, 200);
  } catch (err) {
    console.error('[QStash] Job failed:', err);
    // Return 500 so QStash retries the job
    return c.json({ error: 'Job processing failed', retryable: true }, 500);
  }
});

export default webhooksRoutes;
```

No change needed in `apps/server/src/index.ts` — it already mounts `webhooksRoutes` at `/api/webhooks`.

### `src/jobs/index.ts` — barrel

```typescript
export { publishJob, publishCron } from './publish';
export type { JobType, JobPayload } from './types';
```

### Cron Schedules

Register once during deployment (or via Upstash dashboard):

| Job                  | Schedule      | Description                                     |
| -------------------- | ------------- | ----------------------------------------------- |
| `notification.batch` | `*/5 * * * *` | Group and send digest notifications every 5m    |
| `ip.anonymize`       | `0 0 * * *`   | Anonymise IPs older than 30 days (midnight UTC) |

### Retry Policy

| Job Type                   | Retries | Backoff                      |
| -------------------------- | ------- | ---------------------------- |
| `email.send`               | 5       | Exponential (1s, 10s, 100s…) |
| `account.anonymize`        | 3       | Exponential                  |
| `notification.push`        | 3       | Exponential                  |
| `venue.subscription-retry` | 5       | Exponential                  |
| `data-export.process`      | 2       | Exponential                  |
| All others                 | 3       | Exponential (QStash default) |

QStash moves permanently failed jobs (exhausted retries) to a dead-letter queue visible in the Upstash console.

### Developer API (how other parts of the codebase publish jobs)

```typescript
import { publishJob } from '@/jobs';

// Send a transactional email (use this instead of sendEmail() directly)
await publishJob('email.send', {
  to: user.email,
  template: 'venue-activation',
  data: { venueName: profile.name },
});

// Schedule GDPR anonymisation 30 days from now
await publishJob(
  'account.anonymize',
  { userId: user.id, requestedAt: new Date().toISOString() },
  { delay: '30d' }
);

// Send push notification
await publishJob('notification.push', {
  deviceToken: token,
  title: 'Event Approved',
  body: 'Your event is now live on the map.',
  persona: 'artist',
  route: `/events/${eventId}`,
});
```

---

## Acceptance Criteria

- [ ] `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`, `QSTASH_BASE_URL` documented in `apps/server/.env.example`
- [ ] QStash env vars added to `packages/env/src/server.ts` (optional, validated at startup)
- [ ] `@upstash/qstash` installed in `apps/server`
- [ ] `qstashClient` initialises without errors when env vars are present
- [ ] All 9 job types defined with TypeScript payload schemas and Zod validation in `src/jobs/types.ts`
- [ ] `publishJob()` correctly publishes a message to QStash (verified in Upstash console)
- [ ] `POST /api/v1/webhooks/qstash` with a valid signature returns `200 { received: true }`
- [ ] `POST /api/v1/webhooks/qstash` with a missing or invalid signature returns `401`
- [ ] `POST /api/v1/webhooks/qstash` with an unknown job type returns `500` (QStash will retry, then DLQ)
- [ ] `routeJob()` dispatches each job type to the correct handler function
- [ ] `email.send` handler calls `sendEmail()` from `packages/email` (real implementation)
- [ ] All other 8 handler stubs exist and throw `new Error('Not implemented')`
- [ ] `publishJob("account.anonymize", payload, { delay: "30d" })` produces a delayed QStash message
- [ ] Cron schedules for `notification.batch` and `ip.anonymize` created in Upstash
- [ ] All job executions logged with job type and timestamp (at minimum)
- [ ] Existing Stripe and Postmark webhook stubs in `webhooks.ts` are preserved

---

## Technical Notes

### Why QStash?

| Alternative     | Problem                                                                                       |
| --------------- | --------------------------------------------------------------------------------------------- |
| BullMQ + Redis  | Requires a persistent Redis connection — incompatible with Lambda's ephemeral execution model |
| AWS SQS         | Overkill for V1 scale; adds more AWS IAM complexity; no built-in HTTP delivery                |
| AWS EventBridge | Good for event routing but more complex setup for retry/DLQ                                   |
| **QStash**      | HTTP-native, serverless-first, built-in retry + DLQ, Upstash already in the stack             |

### Local Development

QStash requires a publicly accessible URL to deliver jobs. Two options for local testing:

1. **ngrok**: `ngrok http 3001` → use the ngrok URL as `QSTASH_BASE_URL`
2. **QStash local server**: `npx @upstash/qstash-cli dev` — runs a local QStash emulator that POSTs directly to `localhost:3001`

For initial scaffolding (this task), use option 2 as it requires no external account setup.

### Signature Verification with `rawBody`

Hono's `c.req.text()` must be called **before** any other body parsing (e.g., `c.req.json()`). Once the body stream is consumed, it cannot be re-read. The `verifyQStashSignature` middleware reads `c.req.text()`, verifies the signature, then stores the raw string in `c.set("rawBody", body)` so the handler can re-parse it as JSON.

### Maximum Payload Size

QStash limits message bodies to **1 MB**. For GDPR data exports (which can be large), store the data in S3 and pass only the S3 key as the job payload:

```typescript
// Don't include the export data in the job
await publishJob('data-export.process', {
  userId: user.id,
  requestId: exportRequest.id,
  // handler fetches data from DB, writes to S3
});
```

### Cron Expressions Use UTC

All QStash cron schedules run in UTC. Ireland observes IST (UTC+1) in summer and GMT (UTC+0) in winter. For jobs that should run at Irish midnight, use `0 0 * * *` in winter and `0 23 * * *` in summer — or keep it UTC and accept the 1-hour drift.

---

## Common Gotchas

- **`QSTASH_BASE_URL` must be a public HTTPS URL** — QStash cannot reach `localhost`. Use ngrok or the Upstash local CLI during development.
- **Signature keys rotate periodically** — Always verify against both `QSTASH_CURRENT_SIGNING_KEY` and `QSTASH_NEXT_SIGNING_KEY`. The `Receiver` from `@upstash/qstash` handles this automatically.
- **Lambda cold starts and job timeouts** — QStash has a default delivery timeout of 30 seconds. If a Lambda cold start adds >25s to a handler, QStash will consider the delivery failed and retry. Use Provisioned Concurrency or keep handler warm for time-sensitive jobs.
- **Returning 200 vs 500** — Always return `200` for successful processing and `500` for retryable failures. Returning `400` signals to QStash that the message is malformed and sends it directly to DLQ without retrying.
- **Dead-letter queue alerting** — Monitor the DLQ in the Upstash console. Set up a QStash DLQ webhook (or poll via Upstash API) to alert when jobs land there — this indicates a handler is broken.
- **Do not call `sendEmail()` directly from tRPC handlers** — always go through `publishJob('email.send', ...)` in production code. Direct calls bypass retry, logging, and observability.

---
