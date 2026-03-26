# M1-T6 · Postmark Email Service Setup

| Field          | Value                                                                                                             |
| -------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Milestone**  | M1 — Project Setup & Infrastructure                                                                               |
| **Status**     | ✅ Code Complete — Postmark account setup pending (no domain access yet)                                          |
| **Depends on** | M1-T1 (Turborepo + monorepo structure)                                                                            |
| **Blocks**     | M2-T1 (email verification), M2-T3 (forgot password), M8-T1 (venue activation email), M8-T2 (payment confirmation) |
| **PRD Ref**    | Section 10.1 (Postmark — transactional email), Authentication flows                                               |

---

## Description

Configure Postmark as the transactional email provider and establish the `packages/email` workspace package. All CeolX transactional emails — email verification, password reset, venue activation link, and payment confirmation — are sent via Postmark. This task sets up the Postmark account, configures sender identity, and creates the reusable `sendEmail()` utility that every downstream milestone imports. No templates are implemented here — only the sending infrastructure.

Postmark was chosen for deliverability and reliability (dedicated IP option) over SendGrid or Mailgun. The dedicated `packages/email` package keeps all email transport logic in one place so `apps/server` and future callers never reference Postmark directly.

Local development always routes through **Mailpit** (SMTP) — regardless of whether `POSTMARK_API_TOKEN` is set — to prevent accidental emails to real users.

---

## Affected Apps / Packages

| App / Package    | Role                                                                               |
| ---------------- | ---------------------------------------------------------------------------------- |
| `packages/email` | New workspace package — transport factory, `sendEmail()` utility, TypeScript types |
| `apps/server`    | Imports `sendEmail()` from `@CeolX/email`; wires calls in M2–M8                    |

---

## Requirements

### 1. Postmark Account Configuration

- Create Postmark account (or use existing RaftLabs account) with a dedicated **Server** for CeolX
- Configure **Sender Signature** for `noreply@ceolx.ie` — verify domain DNS records (SPF, DKIM, DMARC)
- Set up one **Message Stream**:
  - `outbound` — all transactional emails (verification, reset, notifications)
  - Do NOT use the broadcast stream in V1
- Store `POSTMARK_API_TOKEN` (Server API Token) as environment variable — never hardcoded
- Configure bounce and spam complaint webhooks pointing to `POST /api/webhooks/postmark` (stub added in this task, wired in M7)

### 2. `packages/email` Workspace Package

Create `packages/email/` as a new Turborepo workspace:

```
packages/email/
  package.json      — name: @CeolX/email, deps: postmark, nodemailer
  tsconfig.json
  src/
    index.ts        — barrel export
    client.ts       — EmailTransport interface + transport factory
    constants.ts    — SENDER_EMAIL, SENDER_NAME, SUPPORT_EMAIL
    send.ts         — sendEmail() entry point
    types.ts        — EmailTag, SendEmailOptions
```

- `sendEmail()` accepts `{ to, subject, htmlBody, textBody, tag }` — tag used for Postmark stream analytics
- Log success and failure with structured context `{ tag, to, timestamp }` — do NOT log subject or body content (PII risk)
- On error: log and re-throw — callers decide retry logic
- No `EmailDeliveryError` wrapper class — plain re-throw keeps the stack clean

### 3. Transport Factory (`client.ts`)

The transport is selected at startup based on `NODE_ENV`:

| Environment              | Transport                 | Notes                                      |
| ------------------------ | ------------------------- | ------------------------------------------ |
| `development`            | nodemailer → Mailpit SMTP | Always, regardless of `POSTMARK_API_TOKEN` |
| `staging` / `production` | Postmark `ServerClient`   | Throws at startup if token missing         |

- `EmailTransport` interface: `send({ from, to, subject, html, text }): Promise<void>`
- Lazy singleton — instantiated once per process/Lambda context
- Postmark: `MessageStream: "outbound"` on every send

### 4. Email Tags (V1)

| Email                 | Trigger                        | Tag                    |
| --------------------- | ------------------------------ | ---------------------- |
| Email verification    | Sign-up                        | `email-verification`   |
| Password reset        | Forgot password flow           | `password-reset`       |
| Venue activation link | Venue persona selected         | `venue-activation`     |
| Payment confirmation  | Stripe webhook payment success | `payment-confirmation` |

Templates for each email are implemented in the milestone that triggers them (M2, M8). This task only wires the sending infrastructure.

### 5. Environment Variables

```bash
# apps/server .env
POSTMARK_API_TOKEN=your-postmark-server-token   # absent in local dev — Mailpit used instead
POSTMARK_FROM_ADDRESS=noreply@ceolx.ie
SMTP_HOST=localhost                              # local dev Mailpit
SMTP_PORT=1025                                  # local dev Mailpit
```

Add `POSTMARK_API_TOKEN`, `POSTMARK_FROM_ADDRESS`, `SMTP_HOST`, `SMTP_PORT` to `packages/env/src/server.ts` Zod schema (all optional except `POSTMARK_FROM_ADDRESS` which defaults to `noreply@ceolx.ie`).

### 6. Local Development — Mailpit

Run Mailpit via Docker for local email catching:

```bash
docker run -d -p 1025:1025 -p 8025:8025 axllent/mailpit
```

- SMTP on port 1025 (nodemailer target)
- Web UI on `http://localhost:8025` — inspect all outgoing emails

In `development`, `getTransport()` always returns the SMTP transport. `POSTMARK_API_TOKEN` is intentionally not required locally.

### 7. Postmark Webhook Stub

Add stub route to `apps/server/src/routes/webhooks.ts`:

```
POST /api/webhooks/postmark
```

Returns `{ message: "not implemented" }` for now. Wired in M7 to handle bounce and spam complaint events.

---

## Acceptance Criteria

- [ ] Postmark account created with `ceolx` Server and sender signature verified for `noreply@ceolx.ie` ⏳ pending domain access
- [ ] SPF, DKIM, DMARC DNS records added and verified in Postmark dashboard ⏳ pending domain access
- [x] `packages/email` workspace created and resolvable as `@CeolX/email` — PR #5
- [x] `sendEmail()` implemented with transport factory, structured logging (no body/subject in logs) — PR #5
- [x] `NODE_ENV=development` always routes to Mailpit — no accidental real emails — PR #5
- [x] `POSTMARK_API_TOKEN`, `POSTMARK_FROM_ADDRESS`, `SMTP_HOST`, `SMTP_PORT` added to env schema and `.env` templates — PR #5
- [x] `POST /api/webhooks/postmark` stub route added to `apps/server` — PR #5
- [x] TypeScript compilation passes with zero errors across the monorepo — PR #5
- [ ] Smoke test (local): call `sendEmail()` → email appears in Mailpit at `http://localhost:8025` ⏳ manual verification pending
- [ ] Smoke test (Postmark): set real token in staging → email received in Postmark test inbox ⏳ pending Postmark account

---

## Technical Notes

### Transport Factory

```typescript
// packages/email/src/client.ts

import nodemailer from "nodemailer";
import { ServerClient } from "postmark";

export interface EmailTransport {
  send(options: {
    from: string;
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<void>;
}

function createPostmarkTransport(token: string): EmailTransport {
  const client = new ServerClient(token);
  return {
    async send({ from, to, subject, html, text }) {
      await client.sendEmail({
        From: from,
        To: to,
        Subject: subject,
        HtmlBody: html,
        TextBody: text,
        MessageStream: "outbound",
      });
    },
  };
}

function createSmtpTransport(): EmailTransport {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "localhost",
    port: Number(process.env.SMTP_PORT ?? 1025),
    secure: false,
  });
  return {
    async send({ from, to, subject, html, text }) {
      await transporter.sendMail({ from, to, subject, html, text });
    },
  };
}

let transport: EmailTransport | undefined;

export function getTransport(): EmailTransport {
  if (transport) return transport;
  if (process.env.NODE_ENV === "development") {
    transport = createSmtpTransport();
  } else {
    const token = process.env.POSTMARK_API_TOKEN;
    if (!token)
      throw new Error(
        "POSTMARK_API_TOKEN is required in non-development environments",
      );
    transport = createPostmarkTransport(token);
  }
  return transport;
}
```

### sendEmail Utility

```typescript
// packages/email/src/send.ts

import { getTransport } from "./client";
import { SENDER_EMAIL, SENDER_NAME } from "./constants";
import type { SendEmailOptions } from "./types";

export async function sendEmail({
  to,
  subject,
  htmlBody,
  textBody,
  tag,
}: SendEmailOptions): Promise<void> {
  const transport = getTransport();
  try {
    await transport.send({
      from: `${SENDER_NAME} <${SENDER_EMAIL}>`,
      to,
      subject,
      html: htmlBody,
      text: textBody,
    });
    console.log("[email]", { tag, to, timestamp: new Date().toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[email] failed", { tag, to, error: message });
    throw error;
  }
}
```

### TypeScript Types

```typescript
// packages/email/src/types.ts

export type EmailTag =
  | "email-verification"
  | "password-reset"
  | "venue-activation"
  | "payment-confirmation";

export interface SendEmailOptions {
  to: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  tag: EmailTag;
}
```

---

## Common Gotchas

- **Domain verification**: Postmark requires SPF + DKIM DNS records verified before sending from a custom domain — allow 24–48 hours for DNS propagation
- **Singleton transport**: Postmark SDK creates an HTTP connection pool; instantiate once per Lambda execution context (not per request)
- **Do NOT log email bodies or subjects**: they can contain PII (email addresses, reset tokens) — log only `{ tag, to, timestamp }`
- **Mailpit always in dev**: `getTransport()` checks `NODE_ENV` first — `POSTMARK_API_TOKEN` is irrelevant locally
- **Apple rule**: Venue activation email contains the Stripe subscription URL. This is sent from `noreply@ceolx.ie` (outside the app) — not shown inside the iOS app. This is intentional and compliant with Apple Rule 3.1.1.
- **Webhook path**: route is `/api/webhooks/postmark` (no `/v1`) — matches the existing Hono routing convention in `apps/server`
