# M1-T6 · Postmark Email Service Setup

| Field          | Value                                                                                                             |
| -------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Milestone**  | M1 — Project Setup & Infrastructure                                                                               |
| **Status**     | 🔲 To Do                                                                                                          |
| **Depends on** | M1-T1 (Turborepo + monorepo structure)                                                                            |
| **Blocks**     | M2-T1 (email verification), M2-T3 (forgot password), M8-T1 (venue activation email), M8-T2 (payment confirmation) |
| **PRD Ref**    | Section 10.1 (Postmark — transactional email), Authentication flows                                               |

---

## Description

Configure Postmark as the transactional email provider and establish the shared email-sending module in `packages/shared`. All CeolX transactional emails — email verification, password reset, venue activation link, and payment confirmation — are sent via Postmark. This task sets up the Postmark account, configures sender identity, and creates the reusable `sendEmail()` utility that every downstream milestone imports. No templates are implemented here — only the sending infrastructure.

Postmark was chosen for deliverability and reliability (dedicated IP option) over SendGrid or Mailgun. The shared module keeps email logic in one place so `apps/api` never calls Postmark directly.

---

## Affected Apps / Packages

| App / Package     | Role                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------ |
| `packages/shared` | New `email/` subdirectory — Postmark client, `sendEmail()` utility, TypeScript types |
| `apps/api`        | Imports `sendEmail()` from shared; wires calls in M2–M8                              |

---

## Requirements

### 1. Postmark Account Configuration

- Create Postmark account (or use existing RaftLabs account) with a dedicated **Server** for CeolX
- Configure **Sender Signature** for `noreply@ceolx.ie` — verify domain DNS records (SPF, DKIM, DMARC)
- Set up two **Message Streams**:
  - `outbound` — all transactional emails (verification, reset, notifications)
  - Do NOT use the broadcast stream in V1
- Store `POSTMARK_API_TOKEN` (Server API Token) as environment variable — never hardcoded
- Configure bounce and spam complaint webhooks pointing to `POST /api/v1/webhooks/postmark` (stub in M1-T3, wired in M7)

### 2. Email Utility in `packages/shared`

Create `packages/shared/src/email/`:

```
packages/shared/src/email/
  client.ts       — Postmark ServerClient singleton
  send.ts         — sendEmail() function with error handling
  types.ts        — EmailPayload TypeScript types
  index.ts        — barrel export
```

- Use official `postmark` npm package
- `sendEmail()` accepts `{ to, subject, htmlBody, textBody, tag }` — tag is used for Postmark stream analytics
- Log success and failure with structured context (recipient, tag, timestamp) — do NOT log email body content
- On Postmark error: throw typed `EmailDeliveryError` with Postmark error code attached; caller decides retry logic
- Add `POSTMARK_API_TOKEN` to the `apps/api` `.env` template

### 3. Email Types Needed (V1)

| Email                 | Trigger                        | Tag                    |
| --------------------- | ------------------------------ | ---------------------- |
| Email verification    | Sign-up                        | `email-verification`   |
| Password reset        | Forgot password flow           | `password-reset`       |
| Venue activation link | Venue persona selected         | `venue-activation`     |
| Payment confirmation  | Stripe webhook payment success | `payment-confirmation` |

Templates for each email are implemented in the milestone that triggers them (M2, M8). This task only wires the sending infrastructure.

### 4. Environment Variables

```bash
# apps/api .env
POSTMARK_API_TOKEN=your-postmark-server-token
POSTMARK_FROM_ADDRESS=noreply@ceolx.ie
```

Both vars must be present in dev, staging, and prod Lambda environments.

### 5. Local Development

- In development (`NODE_ENV=development`): log email content to console instead of sending — use a `DRY_RUN` env flag or check `NODE_ENV`
- Prevents accidental emails to real users during local testing
- Postmark sandbox mode is available as an alternative for integration tests

---

## Acceptance Criteria

- [ ] Postmark account created with `ceolx` Server and sender signature verified for `noreply@ceolx.ie`
- [ ] SPF, DKIM, DMARC DNS records added and verified in Postmark dashboard
- [ ] `packages/shared/src/email/` module created and exported from `packages/shared`
- [ ] `sendEmail()` function implemented with error handling and structured logging
- [ ] `POSTMARK_API_TOKEN` and `POSTMARK_FROM_ADDRESS` added to `.env` template files
- [ ] In development mode, emails log to console instead of sending (no accidental emails)
- [ ] TypeScript compilation passes with zero errors across the monorepo
- [ ] Smoke test: call `sendEmail()` from a test script — email received in Postmark test inbox

---

## Technical Notes

### Postmark Client

```typescript
// packages/shared/src/email/client.ts

import { ServerClient } from "postmark";

let client: ServerClient | null = null;

export function getPostmarkClient(): ServerClient {
  if (!client) {
    const token = process.env.POSTMARK_API_TOKEN;
    if (!token) {
      throw new Error("POSTMARK_API_TOKEN environment variable is not set");
    }
    client = new ServerClient(token);
  }
  return client;
}
```

### sendEmail Utility

```typescript
// packages/shared/src/email/send.ts

import { getPostmarkClient } from "./client";
import type { EmailPayload } from "./types";

export class EmailDeliveryError extends Error {
  constructor(
    message: string,
    public readonly postmarkErrorCode?: number,
  ) {
    super(message);
    this.name = "EmailDeliveryError";
  }
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  const { to, subject, htmlBody, textBody, tag } = payload;

  // Dry-run in development
  if (process.env.NODE_ENV === "development") {
    console.log("[Email DRY RUN]", {
      to,
      subject,
      tag,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const client = getPostmarkClient();
  const fromAddress = process.env.POSTMARK_FROM_ADDRESS ?? "noreply@ceolx.ie";

  try {
    await client.sendEmail({
      From: fromAddress,
      To: to,
      Subject: subject,
      HtmlBody: htmlBody,
      TextBody: textBody,
      Tag: tag,
      MessageStream: "outbound",
    });

    console.log("[Email sent]", {
      to,
      tag,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const code = (err as { code?: number })?.code;
    console.error("[Email failed]", { to, tag, error: (err as Error).message });
    throw new EmailDeliveryError(
      `Failed to send email: ${(err as Error).message}`,
      code,
    );
  }
}
```

### TypeScript Types

```typescript
// packages/shared/src/email/types.ts

export interface EmailPayload {
  to: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  tag: EmailTag;
}

export type EmailTag =
  | "email-verification"
  | "password-reset"
  | "venue-activation"
  | "payment-confirmation";
```

---

## Common Gotchas

- **Domain verification**: Postmark requires SPF + DKIM DNS records verified before sending from a custom domain — allow 24–48 hours for DNS propagation
- **Singleton client**: Postmark SDK creates an HTTP connection pool; instantiate once per Lambda execution context (not per request)
- **Do NOT log email bodies**: HTML bodies can contain PII (email addresses, reset tokens) — log only metadata
- **Postmark error codes**: Code `422` means invalid recipient; code `406` means inactive recipient — handle these differently from transient failures
- **Apple rule**: Venue activation email contains the Stripe subscription URL. This is sent from `noreply@ceolx.ie` (outside the app) — not shown inside the iOS app. This is intentional and compliant with Apple Rule 3.1.1.
