# Task 7: QStash Background Jobs Setup

## Description

Set up Upstash QStash as the background job queue for the Mentor platform. QStash provides serverless message queuing that works seamlessly with Vercel serverless functions. This task covers the QStash client configuration, job type definitions, webhook receiver endpoints in the Hono API, retry policies, and dead-letter queue handling. Background jobs are critical for email delivery, data export processing, account anonymization, notification batching, Typesense search index syncing, and scheduled cron operations.

## Affected Apps/Packages

- Backend: `apps/api` (Hono) — webhook receiver endpoints for job processing
- New package: `packages/queue` (`@mentor/queue`) — QStash client and job definitions
- Shared: `packages/email` — email jobs are the primary consumer
- Shared: `packages/db` — database operations triggered by background jobs

## Requirements

### QStash Configuration

- Create Upstash account and provision QStash instance
- Store credentials in environment variables:
  - `QSTASH_TOKEN` — API token for publishing messages
  - `QSTASH_CURRENT_SIGNING_KEY` — for webhook signature verification
  - `QSTASH_NEXT_SIGNING_KEY` — for key rotation
- Configure QStash base URL pointing to the API's webhook receiver

### Queue Package Architecture

- Create `packages/queue/` with:
  - `src/client.ts` — QStash client initialization
  - `src/publish.ts` — Type-safe job publishing functions
  - `src/verify.ts` — Webhook signature verification middleware
  - `src/types.ts` — Job type definitions and payload schemas
  - `src/constants.ts` — Queue names, retry policies, delays

### Job Types to Define

| Job Type                | Trigger                        | Processing                                |
| ----------------------- | ------------------------------ | ----------------------------------------- |
| `email.send`            | Auth, notifications, approvals | Send via Postmark                         |
| `data-export.process`   | User requests data export      | Query DB, generate JSON/CSV, upload to R2 |
| `data-export.notify`    | Export file ready              | Send download link email                  |
| `account.anonymize`     | 30 days after deletion request | Anonymize user data in DB                 |
| `account.cleanup`       | After anonymization            | Remove R2 files, revoke sessions          |
| `notification.batch`    | Periodic (every 5 min)         | Group notifications, send digest          |
| `search.sync`           | Course created/updated/deleted | Sync to Typesense index                   |
| `search.reindex`        | Admin triggers full reindex    | Bulk reindex all courses                  |
| `payment.webhook-retry` | Stripe webhook fails           | Retry webhook processing                  |
| `analytics.track`       | User actions                   | Batch send to analytics providers         |
| `ip.anonymize`          | Daily cron (midnight UTC)      | Anonymize IPs older than 30 days          |
| `video.process-status`  | Mux webhook                    | Update video processing status            |

### Webhook Receiver Endpoints

- `POST /api/webhooks/qstash` — Main QStash webhook receiver
- Implement signature verification using `@upstash/qstash` SDK
- Route jobs to appropriate handlers based on job type
- Return appropriate HTTP status codes (200 for success, 500 for retry)

### Retry & Error Handling

- Default retry policy: 3 retries with exponential backoff (1s, 10s, 100s)
- Custom retry policies per job type (e.g., email: 5 retries, data export: 2 retries)
- Dead-letter queue for permanently failed jobs
- Alert admin on dead-letter queue items (via admin notification inbox)
- Log all job executions with status, duration, and error details

### Cron Schedules

- `notification.batch`: Every 5 minutes
- `ip.anonymize`: Daily at 00:00 UTC
- `account.anonymize`: Daily at 02:00 UTC (process pending deletions)

### Developer API

```typescript
// Publishing a job
import { publishJob } from "@mentor/queue";

await publishJob("email.send", {
  to: user.email,
  template: "enrollment-confirmation",
  locale: "en",
  data: { courseName, userName },
});

// Publishing with delay
await publishJob("account.anonymize", { userId }, { delay: "30d" });

// Publishing a scheduled cron
await publishCron("notification.batch", "*/5 * * * *", {});
```

## Acceptance Criteria

- [x] QStash client initializes with credentials from environment variables
- [x] All 12 job types defined with TypeScript payload schemas
- [x] `publishJob()` successfully publishes messages to QStash
- [x] Webhook receiver at `/api/webhooks/qstash` processes incoming jobs
- [x] Signature verification rejects invalid/tampered requests
- [x] Jobs route to correct handlers based on type
- [x] Retry policy applies correctly (exponential backoff)
- [x] Dead-letter queue captures permanently failed jobs
- [x] Cron schedules created for batch notifications and IP anonymization
- [x] All job executions logged with status and duration
- [x] Unit tests for job type validation and routing
- [x] Integration test with QStash sandbox confirming end-to-end flow
- [x] Environment variables documented in `.env.example`

## Dependencies

- Upstash account with QStash provisioned
- Hono API deployed and accessible via public URL (for QStash callbacks)
- Postmark email service (Task 06) for email job processing
- Database package (Milestone 02) for data operations

## Technical Notes

### Why QStash?

- Serverless-native: works with Vercel without persistent connections
- HTTP-based: no WebSocket or long-polling required
- Built-in retry, scheduling, and dead-letter queues
- Pay-per-message pricing (cost-effective for V1 volume)
- Signature verification for secure webhook delivery

### QStash vs Alternatives

- **BullMQ/Redis**: Requires persistent connection, not ideal for serverless
- **AWS SQS**: Overkill for V1, adds AWS dependency
- **QStash**: Perfect serverless fit, Upstash already used for Redis cache

### Common Gotchas

- QStash requires a publicly accessible URL for callbacks (use Vercel deployment URL)
- In development, use QStash's local tunnel or ngrok for testing
- Signature keys rotate periodically — always verify with both current and next keys
- Maximum message size is 1MB — for larger payloads, store in R2 and pass reference
- Cron expressions use UTC timezone
