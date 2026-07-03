# M7-T4 PR4 — GDPR lifecycle emails Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship two GDPR lifecycle emails wired end-to-end — `account-deleted` (on erasure) and `inactivity-warning` (on inactive-flagging) — and fix the dispatcher type-exhaustiveness break PR2 left behind.

**Architecture:** `account-deleted` is a bespoke React Email template sent directly from the anonymisation handler (capturing the address before erasure overwrites it). `inactivity-warning` reuses the existing generic `notification` template, sent directly from the flag-inactive sweep. Both are Category B (email-only) — neither goes through `dispatchNotification`. A small dispatcher re-typing removes a latent `TS2741` exhaustiveness error.

**Tech Stack:** TypeScript, React Email (`@react-email/components`), Drizzle ORM, Vitest, Turborepo, Postmark transport (`@CeolX/email`).

## Global Constraints

- **Base branch:** `development` (contains M7-T4 PR1 #136 + PR2 #137). Work branch `feature/m7-t4-gdpr-emails` is already created off it.
- **Email copy lives in `@CeolX/shared`**, not inline in handlers (project convention).
- **Commit subjects must be fully lowercase incl. acronyms** (`gdpr`, `pr`, `tsc`) — commitlint enforced. Read `commitlint.config.js` if unsure.
- **No `StyleSheet.create`** — N/A here (email uses inline style objects from `email-styles.ts`).
- **Email sends in job handlers are non-blocking** — wrap in `try/catch`, log, never throw (R8.5). GDPR erasure must never depend on email delivery.
- **PR base is `development`** — `gh pr create --base development`.
- **Out of scope (do not build):** `data-export-ready` (S-07/A-19/V-18 — export pipeline stubbed), X-01 admin reset (covered by existing `password-reset`).
- **Pre-existing & out of scope:** `server#check-types` emits `TS2875 hono/jsx/jsx-runtime` errors on every `.tsx` template. These exist on `development` before this PR. Do NOT try to fix them. The real build gate is `turbo build` (tsdown), which does not type-check.

---

### Task 1: Fix dispatcher exhaustiveness (`TS2741`)

Do this FIRST. PR2 added `collaborator-invite` to the `EmailTemplate` union but the `email.send` dispatcher map (`Record<EmailTemplate, Dispatch>`) omits it — a real `TS2741` error masked locally by the `tsc` incremental cache. Re-key the map to the queue-able subset so direct-send-only templates (`collaborator-invite`, and the `account-deleted` added in Task 2) never need a queue entry.

**Files:**

- Modify: `apps/server/src/jobs/types.ts` (export a new type + update a comment, near line 9-21)
- Modify: `apps/server/src/jobs/handlers/email.ts:1-22` (import + map type)
- Test: existing `apps/server/src/__tests__/jobs/jobs.email.handler.test.ts` (must stay green — runtime unchanged)

**Interfaces:**

- Produces: `QueueableEmailTemplate` (exported type from `apps/server/src/jobs/types.ts`) = union of the 7 queue-dispatched template keys.

- [ ] **Step 1: Reproduce the failing type-check (capture the baseline error)**

Run:

```bash
pnpm exec turbo run check-types --filter=server --force 2>&1 | grep "TS2741"
```

Expected: one line —
`src/jobs/handlers/email.ts(22,7): error TS2741: Property '"collaborator-invite"' is missing ... required in type 'Record<keyof EmailTemplateMap, Dispatch>'.`

(You will also see many `TS2875 hono/jsx/jsx-runtime` lines — those are pre-existing and out of scope. We only care about `TS2741`.)

- [ ] **Step 2: Export the queue-able template type in `types.ts`**

In `apps/server/src/jobs/types.ts`, the block at lines 9-21 currently reads:

```ts
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
  'notification',
] as const satisfies readonly EmailTemplate[];
```

Replace that comment block and add the exported type immediately after the `const`:

```ts
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
```

- [ ] **Step 3: Re-key the dispatcher map in `email.ts`**

In `apps/server/src/jobs/handlers/email.ts`, change the import block (lines 1-12) — drop the now-unused `type EmailTemplate` from the `@CeolX/email` import and import `QueueableEmailTemplate` from the local types module:

```ts
import {
  sendEventApprovedEmail,
  sendEventRejectedEmail,
  sendNotificationEmail,
  sendPasswordResetEmail,
  sendPaymentConfirmationEmail,
  sendVenueActivationEmail,
  sendVerificationEmail,
} from '@CeolX/email';

import type { JobPayload, QueueableEmailTemplate } from '../types.ts';
```

Then change the map annotation (line 22) from:

```ts
const dispatchers: Record<EmailTemplate, Dispatch> = {
```

to:

```ts
const dispatchers: Record<QueueableEmailTemplate, Dispatch> = {
```

Leave the 7 map entries and `handleEmailSend` unchanged.

- [ ] **Step 4: Verify `TS2741` is gone**

Run:

```bash
pnpm exec turbo run check-types --filter=server --force 2>&1 | grep "TS2741"
```

Expected: **no output** (exit 1 from grep — no match). The `TS2875` JSX lines remain (pre-existing, ignored).

- [ ] **Step 5: Verify the dispatcher still works at runtime**

Run:

```bash
pnpm --filter server test src/__tests__/jobs/jobs.email.handler.test.ts
```

Expected: PASS (the map's runtime entries are unchanged).

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/jobs/types.ts apps/server/src/jobs/handlers/email.ts
git commit -m "fix(server): re-key email dispatcher to queue-able templates"
```

---

### Task 2: `account-deleted` email template (email package)

A bespoke confirmation template with **no CTA** (the account is gone). Follows the exact 6-file pattern of the other templates.

**Files:**

- Modify: `packages/email/src/types.ts` (add map entry, after the `collaborator-invite` block ~line 45-50)
- Create: `packages/email/src/templates/account-deleted.tsx`
- Modify: `packages/email/src/registry.ts` (import + entry)
- Modify: `packages/email/src/subjects.ts` (subject builder)
- Create: `packages/email/src/senders/account-deleted.ts`
- Modify: `packages/email/src/index.ts` (export sender)
- Test: `packages/email/src/__tests__/templates.test.ts`, `subjects.test.ts`, `senders.test.ts`, `registry.test.ts`

**Interfaces:**

- Produces: `sendAccountDeletedEmail({ to: string; userName?: string }): Promise<void>` (exported from `@CeolX/email`).
- Produces: `AccountDeletedEmail` React component; template key `'account-deleted'` with data `{ userName: string }`.

- [ ] **Step 1: Write the failing tests**

In `packages/email/src/__tests__/registry.test.ts`, add `'account-deleted'` to the `ALL_TEMPLATES` array (after `'collaborator-invite'`):

```ts
  'notification',
  'collaborator-invite',
  'account-deleted',
];
```

In `packages/email/src/__tests__/subjects.test.ts`, add this `it` block before the final closing `});` of the `describe('subjectFor', ...)`:

```ts
it('returns the matrix S-06 subject for account-deleted', () => {
  expect(subjectFor('account-deleted', { userName: 'Aoife' })).toBe(
    'Your CeolX account has been deleted'
  );
});
```

In `packages/email/src/__tests__/senders.test.ts`, add the import alongside the others at the top:

```ts
import { sendAccountDeletedEmail } from '../senders/account-deleted.js';
```

and append this `describe` at the end of the file:

```ts
describe('sendAccountDeletedEmail', () => {
  it('dispatches the account-deleted template with userName', async () => {
    await sendAccountDeletedEmail({ to: 'gone@example.com', userName: 'Aoife' });
    expect(sendEmail).toHaveBeenCalledWith({
      to: 'gone@example.com',
      template: 'account-deleted',
      data: { userName: 'Aoife' },
    });
  });

  it('defaults userName to empty string when omitted', async () => {
    await sendAccountDeletedEmail({ to: 'gone@example.com' });
    expect(vi.mocked(sendEmail).mock.calls[0]?.[0].data).toMatchObject({ userName: '' });
  });
});
```

In `packages/email/src/__tests__/templates.test.ts`, add the import alongside the others:

```ts
import { AccountDeletedEmail } from '../templates/account-deleted.js';
```

and append this `describe` at the end of the file:

```ts
// ---------------------------------------------------------------------------
// account-deleted (matrix S-06 / A-18 / V-17 — GDPR erasure confirmation)
// ---------------------------------------------------------------------------
describe('AccountDeletedEmail', () => {
  it('confirms deletion and greets the user by name', async () => {
    const html = await render(React.createElement(AccountDeletedEmail, { userName: 'Aoife' }));
    expect(html).toContain('Aoife');
    expect(html).toMatch(/deleted/i);
  });

  it('falls back to "there" when userName is empty', async () => {
    const html = await render(React.createElement(AccountDeletedEmail, { userName: '' }));
    expect(html).toContain('>there<');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
pnpm --filter @CeolX/email test
```

Expected: FAIL — module `../senders/account-deleted.js` / `../templates/account-deleted.js` not found, and `registry`/`subjects` errors for the missing `'account-deleted'` key.

- [ ] **Step 3: Add the template data shape to `types.ts`**

In `packages/email/src/types.ts`, add this entry immediately after the `'collaborator-invite'` block (just before the closing `};` of `EmailTemplateMap`):

```ts
  /**
   * GDPR erasure confirmation (matrix S-06 / A-18 / V-17). Sent to the account's
   * original email immediately after anonymisation. No CTA — the account no
   * longer exists. `userName` is the pre-erasure display name (may be empty).
   */
  'account-deleted': { userName: string };
```

- [ ] **Step 4: Create the template component**

Create `packages/email/src/templates/account-deleted.tsx`:

```tsx
/** @jsxRuntime automatic @jsxImportSource react */
import { Text } from '@react-email/components';

import { EmailLayout } from './components/email-layout.js';
import { bodyText, heading, mutedText } from './components/email-styles.js';

interface AccountDeletedEmailProps {
  userName: string;
}

export function AccountDeletedEmail({ userName }: AccountDeletedEmailProps) {
  return (
    <EmailLayout preview="Your CeolX account has been deleted">
      <Text style={heading}>Your CeolX account has been deleted</Text>

      <Text style={bodyText}>Hi {userName || 'there'},</Text>

      <Text style={bodyText}>
        Your CeolX account and personal data have been permanently deleted, as you requested. This
        action is final and cannot be undone.
      </Text>

      <Text style={mutedText}>
        If you didn&apos;t request this, contact us at admin@ceolx.com straight away.
      </Text>
    </EmailLayout>
  );
}
```

- [ ] **Step 5: Register the component**

In `packages/email/src/registry.ts`, add the import (keep alphabetical with the others):

```ts
import { AccountDeletedEmail } from './templates/account-deleted.js';
```

and add the registry entry after the `'collaborator-invite'` entry:

```ts
  'account-deleted': { component: AccountDeletedEmail },
```

- [ ] **Step 6: Add the subject builder**

In `packages/email/src/subjects.ts`, add after the `'collaborator-invite'` entry in `builders`:

```ts
  'account-deleted': () => 'Your CeolX account has been deleted',
```

- [ ] **Step 7: Create the sender**

Create `packages/email/src/senders/account-deleted.ts`:

```ts
import { sendEmail } from '../send.js';

interface AccountDeletedParams {
  to: string;
  userName?: string;
}

/**
 * Dispatch the account-deleted confirmation (matrix S-06 / A-18 / V-17). Called
 * directly by the GDPR anonymisation handler with the account's original email,
 * captured before erasure overwrites it. Email-only — never queued.
 */
export async function sendAccountDeletedEmail({
  to,
  userName = '',
}: AccountDeletedParams): Promise<void> {
  await sendEmail({
    to,
    template: 'account-deleted',
    data: { userName },
  });
}
```

- [ ] **Step 8: Export the sender**

In `packages/email/src/index.ts`, add after the `sendCollaboratorInviteEmail` export:

```ts
export { sendAccountDeletedEmail } from './senders/account-deleted.js';
```

- [ ] **Step 9: Run the tests to verify they pass**

Run:

```bash
pnpm --filter @CeolX/email test
```

Expected: PASS (all suites, including the new `account-deleted` cases).

- [ ] **Step 10: Verify the email package type-checks (exhaustiveness of registry/subjects)**

Run:

```bash
pnpm --filter @CeolX/email check-types
```

Expected: PASS (no error — the registry mapped-type would fail if a new key lacked a component).

- [ ] **Step 11: Commit**

```bash
git add packages/email/src
git commit -m "feat(email): add account-deleted gdpr confirmation template"
```

---

### Task 3: Inactivity-warning copy in `@CeolX/shared`

`inactivity-warning` reuses the `notification` template, so it needs no new template — only the copy + CTA URL, which live in shared per project convention.

**Files:**

- Modify: `packages/shared/src/constants.ts` (add `CEOLX_WEB_URL`, near `VENUE_SUBSCRIPTION_URL` ~line 89)
- Create: `packages/shared/src/notifications/inactivity-email.ts`
- Modify: `packages/shared/src/notifications/index.ts` (export)
- Test: `packages/shared/src/notifications/__tests__/inactivity-email.test.ts`

**Interfaces:**

- Produces: `buildInactivityWarningEmail(): { subject: string; body: string; ctaUrl: string }` (exported from `@CeolX/shared`).
- Produces: `CEOLX_WEB_URL: string` constant (`'https://ceolx.com'`).

- [ ] **Step 1: Write the failing test**

Create `packages/shared/src/notifications/__tests__/inactivity-email.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { CEOLX_WEB_URL } from '../../constants.js';
import { buildInactivityWarningEmail } from '../inactivity-email.js';

describe('buildInactivityWarningEmail', () => {
  it('returns the S-08 subject, a body mentioning inactivity, and the web CTA', () => {
    const copy = buildInactivityWarningEmail();
    expect(copy.subject).toBe('We miss you at CeolX');
    expect(copy.body).toMatch(/inactive/i);
    expect(copy.ctaUrl).toBe(CEOLX_WEB_URL);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm --filter @CeolX/shared test src/notifications/__tests__/inactivity-email.test.ts
```

Expected: FAIL — `../inactivity-email.js` not found and `CEOLX_WEB_URL` not exported.

- [ ] **Step 3: Add the web URL constant**

In `packages/shared/src/constants.ts`, add directly below the `VENUE_SUBSCRIPTION_URL` line (~line 89):

```ts
/** Public CeolX marketing/landing site — used as the CTA for re-engagement emails. */
export const CEOLX_WEB_URL = 'https://ceolx.com';
```

- [ ] **Step 4: Create the copy builder**

Create `packages/shared/src/notifications/inactivity-email.ts`:

```ts
import { CEOLX_WEB_URL } from '../constants.js';

export interface InactivityWarningEmailCopy {
  subject: string;
  body: string;
  ctaUrl: string;
}

/**
 * Copy for the GDPR inactivity warning (matrix S-08). Email-only — not a
 * notification trigger — so it lives here rather than in `triggers.ts`. Sent
 * via the generic `notification` template; the recipient's name is supplied
 * separately by the caller (the template renders the greeting), so the body
 * stays name-agnostic. Goes to any account idle ~24 months, regardless of role.
 */
export function buildInactivityWarningEmail(): InactivityWarningEmailCopy {
  return {
    subject: 'We miss you at CeolX',
    body: 'Your CeolX account has been inactive for almost two years. Log in to keep it active — if it stays idle it may be removed.',
    ctaUrl: CEOLX_WEB_URL,
  };
}
```

- [ ] **Step 5: Export the builder**

In `packages/shared/src/notifications/index.ts`, add:

```ts
export * from './inactivity-email.js';
```

- [ ] **Step 6: Run the test to verify it passes**

Run:

```bash
pnpm --filter @CeolX/shared test src/notifications/__tests__/inactivity-email.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src
git commit -m "feat(shared): add inactivity-warning email copy and web url"
```

---

### Task 4: Wire `account-deleted` into the anonymisation handler

Send the confirmation to the account's **original** email, captured before the erasure transaction overwrites it. Centralised in `applyAnonymization` so both callers (per-user handler + daily sweep) get it. Non-blocking.

**Files:**

- Modify: `apps/server/src/jobs/handlers/account.ts` (signature of `applyAnonymization`, both callers, add import + helper)
- Test: `apps/server/src/__tests__/jobs/account-handler.test.ts`, `apps/server/src/__tests__/jobs/account-sweep-handler.test.ts`

**Interfaces:**

- Consumes: `sendAccountDeletedEmail({ to, userName })` from Task 2.
- Changes: `applyAnonymization(userId: string, contact: { email: string | null; name: string | null }): Promise<void>` (was `applyAnonymization(userId: string)`).

- [ ] **Step 1: Write the failing tests**

In `apps/server/src/__tests__/jobs/account-handler.test.ts`, add the email mock at the top (after the existing `vi.mock` calls, before the `import ... vitest` line). Also extend the `user` schema mock to expose `email`/`name`:

```ts
const mockSendAccountDeleted = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock('@CeolX/email', () => ({ sendAccountDeletedEmail: mockSendAccountDeleted }));
```

Change the auth-schema mock (currently `user: { id: 'id' }`) to:

```ts
vi.mock('@CeolX/db/schema/auth', () => ({
  user: { id: 'id', email: 'email', name: 'name' },
  session: { userId: 'user_id' },
}));
```

Update the two anonymisation-path `mockSelectLimit.mockResolvedValueOnce([...])` rows to include `email`/`name`, e.g.:

```ts
mockSelectLimit.mockResolvedValueOnce([
  {
    isAnonymized: false,
    deletionScheduledFor: new Date('2026-05-28'),
    email: 'real@example.com',
    name: 'Aoife',
  },
]);
```

Then append a new `describe`:

```ts
describe('handleAccountAnonymize — deletion confirmation email', () => {
  it('emails the original address after anonymising', async () => {
    mockSelectLimit.mockResolvedValueOnce([
      {
        isAnonymized: false,
        deletionScheduledFor: new Date('2026-05-28'),
        email: 'real@example.com',
        name: 'Aoife',
      },
    ]);

    await handleAccountAnonymize(PAYLOAD);

    expect(mockSendAccountDeleted).toHaveBeenCalledWith({
      to: 'real@example.com',
      userName: 'Aoife',
    });
  });

  it('does not email when the row is a no-op (already anonymised)', async () => {
    mockSelectLimit.mockResolvedValueOnce([
      { isAnonymized: true, deletionScheduledFor: new Date(), email: 'x@example.com', name: 'X' },
    ]);

    await handleAccountAnonymize(PAYLOAD);

    expect(mockSendAccountDeleted).not.toHaveBeenCalled();
  });

  it('still completes erasure when the email send fails', async () => {
    mockSendAccountDeleted.mockRejectedValueOnce(new Error('postmark down'));
    mockSelectLimit.mockResolvedValueOnce([
      {
        isAnonymized: false,
        deletionScheduledFor: new Date('2026-05-28'),
        email: 'real@example.com',
        name: 'Aoife',
      },
    ]);

    await expect(handleAccountAnonymize(PAYLOAD)).resolves.toBeUndefined();
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });
});
```

In `apps/server/src/__tests__/jobs/account-sweep-handler.test.ts`, add the same email mock near the other `vi.mock`s:

```ts
const mockSendAccountDeleted = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock('@CeolX/email', () => ({ sendAccountDeletedEmail: mockSendAccountDeleted }));
```

extend the auth-schema mock to expose `email`/`name`:

```ts
vi.mock('@CeolX/db/schema/auth', () => ({
  user: {
    id: 'id',
    email: 'email',
    name: 'name',
    deletionScheduledFor: 'deletion_scheduled_for',
    isAnonymized: 'is_anonymized',
  },
  session: { userId: 'user_id' },
}));
```

update the two due-row fixtures to include `email`/`name` (e.g. `[{ id: 'user-a', email: 'a@x.ie', name: 'A' }]`), and append:

```ts
describe('handleAccountAnonymizeSweep — deletion confirmation email', () => {
  it('emails each due user at their original address', async () => {
    mockSelectWhere.mockResolvedValueOnce([
      { id: 'user-a', email: 'a@x.ie', name: 'A' },
      { id: 'user-b', email: 'b@x.ie', name: 'B' },
    ]);

    await handleAccountAnonymizeSweep({});

    expect(mockSendAccountDeleted).toHaveBeenCalledTimes(2);
    expect(mockSendAccountDeleted).toHaveBeenCalledWith({ to: 'a@x.ie', userName: 'A' });
    expect(mockSendAccountDeleted).toHaveBeenCalledWith({ to: 'b@x.ie', userName: 'B' });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
pnpm --filter server test src/__tests__/jobs/account-handler.test.ts src/__tests__/jobs/account-sweep-handler.test.ts
```

Expected: FAIL — `sendAccountDeletedEmail` never called (handler doesn't send yet).

- [ ] **Step 3: Add the import and the send helper**

In `apps/server/src/jobs/handlers/account.ts`, add the import after the existing schema imports:

```ts
import { sendAccountDeletedEmail } from '@CeolX/email';
```

Add this helper just above `applyAnonymization`:

```ts
/**
 * GDPR S-06 / A-18 / V-17 confirmation. Sent to the original address captured
 * before erasure. Non-blocking: a mail failure is logged and never rolls back
 * or re-throws — erasure durability comes first (R8.5). Skips the synthetic
 * post-erasure address defensively.
 */
async function sendDeletionConfirmation(
  userId: string,
  { email, name }: { email: string | null; name: string | null }
): Promise<void> {
  if (!email || email.endsWith('@deleted.ceolx.com')) return;
  try {
    await sendAccountDeletedEmail({ to: email, userName: name ?? '' });
  } catch (err) {
    console.error('[account] account-deleted email failed', userId, err);
  }
}
```

- [ ] **Step 4: Thread the captured contact through `applyAnonymization`**

Change the signature and add the send after the transaction. The function header becomes:

```ts
async function applyAnonymization(
  userId: string,
  contact: { email: string | null; name: string | null }
): Promise<void> {
```

Keep the existing `const now = new Date();` and the whole `await db.transaction(...)` block unchanged. Immediately after the transaction block closes (after its `});`), add:

```ts
await sendDeletionConfirmation(userId, contact);
```

- [ ] **Step 5: Update both callers to capture and pass email/name**

In `handleAccountAnonymize`, change the select to also fetch `email`/`name` and pass them in. The select becomes:

```ts
const [row] = await db
  .select({
    isAnonymized: user.isAnonymized,
    deletionScheduledFor: user.deletionScheduledFor,
    email: user.email,
    name: user.name,
  })
  .from(user)
  .where(eq(user.id, userId))
  .limit(1);

if (!row || row.isAnonymized || !row.deletionScheduledFor) {
  return;
}

await applyAnonymization(userId, { email: row.email, name: row.name });
```

In `handleAccountAnonymizeSweep`, change the due-row select and the loop:

```ts
const due = await db
  .select({ id: user.id, email: user.email, name: user.name })
  .from(user)
  .where(
    and(
      isNotNull(user.deletionScheduledFor),
      lte(user.deletionScheduledFor, now),
      eq(user.isAnonymized, false)
    )
  );

for (const u of due) {
  await applyAnonymization(u.id, { email: u.email, name: u.name });
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run:

```bash
pnpm --filter server test src/__tests__/jobs/account-handler.test.ts src/__tests__/jobs/account-sweep-handler.test.ts
```

Expected: PASS (including the existing idempotency/anonymisation cases — unchanged behaviour plus the new email assertions).

- [ ] **Step 7: Commit**

```bash
git add apps/server/src/jobs/handlers/account.ts apps/server/src/__tests__/jobs/account-handler.test.ts apps/server/src/__tests__/jobs/account-sweep-handler.test.ts
git commit -m "feat(server): email account-deleted confirmation on gdpr erasure"
```

---

### Task 5: Wire `inactivity-warning` into the flag-inactive sweep

Change the bulk `UPDATE` to select-then-flag-then-send, so each newly-flagged user gets one warning. Flag-then-send = at-most-once (a failed send is not retried). Non-blocking per user.

**Files:**

- Modify: `apps/server/src/jobs/handlers/inactive.ts` (full rewrite of the handler body)
- Test: `apps/server/src/__tests__/jobs/inactive-handler.test.ts` (rewrite for the new flow)

**Interfaces:**

- Consumes: `sendNotificationEmail({ to, userName, subject, body, ctaUrl })` from `@CeolX/email`; `buildInactivityWarningEmail()` from `@CeolX/shared` (Task 3).

- [ ] **Step 1: Rewrite the test for the new flow**

Replace the entire contents of `apps/server/src/__tests__/jobs/inactive-handler.test.ts` with:

```ts
// Hoisted Drizzle mocks — vi.mock is lifted above imports.

const mockSelectWhere = vi.hoisted(() => vi.fn());
const mockSelectFrom = vi.hoisted(() => vi.fn(() => ({ where: mockSelectWhere })));
const mockSelect = vi.hoisted(() => vi.fn(() => ({ from: mockSelectFrom })));

const mockUpdateWhere = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockUpdateSet = vi.hoisted(() => vi.fn(() => ({ where: mockUpdateWhere })));
const mockUpdate = vi.hoisted(() => vi.fn(() => ({ set: mockUpdateSet })));

const mockAnd = vi.hoisted(() => vi.fn((...args: unknown[]) => ({ kind: 'and', args })));
const mockEq = vi.hoisted(() => vi.fn((col: unknown, val: unknown) => ({ kind: 'eq', col, val })));
const mockLt = vi.hoisted(() => vi.fn((col: unknown, val: unknown) => ({ kind: 'lt', col, val })));
const mockInArray = vi.hoisted(() =>
  vi.fn((col: unknown, vals: unknown) => ({ kind: 'inArray', col, vals }))
);

const mockSendNotification = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('@CeolX/db', () => ({ db: { select: mockSelect, update: mockUpdate } }));
vi.mock('@CeolX/db/schema/auth', () => ({
  user: {
    id: 'id',
    email: 'email',
    name: 'name',
    lastLoginAt: 'last_login_at',
    flaggedInactive: 'flagged_inactive',
    isAnonymized: 'is_anonymized',
  },
}));
vi.mock('drizzle-orm', () => ({
  and: mockAnd,
  eq: mockEq,
  lt: mockLt,
  inArray: mockInArray,
}));
vi.mock('@CeolX/email', () => ({ sendNotificationEmail: mockSendNotification }));

import { afterEach, describe, expect, it, vi } from 'vitest';

import { handleAccountFlagInactive } from '../../jobs/handlers/inactive.js';

afterEach(() => {
  vi.clearAllMocks();
});

describe('handleAccountFlagInactive', () => {
  it('flags the selected due users and warns each one with an email', async () => {
    mockSelectWhere.mockResolvedValueOnce([
      { id: 'u1', email: 'u1@x.ie', name: 'One' },
      { id: 'u2', email: 'u2@x.ie', name: 'Two' },
    ]);

    await handleAccountFlagInactive({});

    expect(mockUpdateSet).toHaveBeenCalledWith({ flaggedInactive: true });
    expect(mockInArray).toHaveBeenCalledWith('id', ['u1', 'u2']);
    expect(mockSendNotification).toHaveBeenCalledTimes(2);
    expect(mockSendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'u1@x.ie', userName: 'One', subject: 'We miss you at CeolX' })
    );
  });

  it('is a no-op (no update, no email) when nothing is due', async () => {
    mockSelectWhere.mockResolvedValueOnce([]);

    await handleAccountFlagInactive({});

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  it('skips users without an email address', async () => {
    mockSelectWhere.mockResolvedValueOnce([{ id: 'u1', email: null, name: 'One' }]);

    await handleAccountFlagInactive({});

    expect(mockUpdateSet).toHaveBeenCalledWith({ flaggedInactive: true });
    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  it('continues the sweep when one email send fails', async () => {
    mockSendNotification.mockRejectedValueOnce(new Error('postmark down'));
    mockSelectWhere.mockResolvedValueOnce([
      { id: 'u1', email: 'u1@x.ie', name: 'One' },
      { id: 'u2', email: 'u2@x.ie', name: 'Two' },
    ]);

    await expect(handleAccountFlagInactive({})).resolves.toBeUndefined();
    expect(mockSendNotification).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm --filter server test src/__tests__/jobs/inactive-handler.test.ts
```

Expected: FAIL — the current handler calls `db.update` directly (no `db.select`, no email), so `mockSelect`/`mockSendNotification` expectations fail.

- [ ] **Step 3: Rewrite the handler**

Replace the entire contents of `apps/server/src/jobs/handlers/inactive.ts` with:

```ts
import { and, eq, inArray, lt } from 'drizzle-orm';

import { db } from '@CeolX/db';
import { user } from '@CeolX/db/schema/auth';
import { sendNotificationEmail } from '@CeolX/email';
import { buildInactivityWarningEmail } from '@CeolX/shared';

import type { JobPayload } from '../types.js';

const INACTIVITY_YEARS = 2;

/**
 * GDPR R6 — flag accounts idle for 24 months and send a one-time re-engagement
 * warning (matrix S-08). Run daily as a QStash cron.
 *
 * Flow: select due rows → flag them → email each. Order is flag-then-send, so a
 * mail failure is never retried (at-most-once warning) and the same user is not
 * re-warned on the next run. Each send is non-blocking; one failure does not
 * abort the sweep. Flagging is a manual-review trigger only — we never
 * auto-anonymise here.
 */
export async function handleAccountFlagInactive(
  _payload: JobPayload<'account.flag-inactive'>
): Promise<void> {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - INACTIVITY_YEARS);

  const due = await db
    .select({ id: user.id, email: user.email, name: user.name })
    .from(user)
    .where(
      and(
        lt(user.lastLoginAt, cutoff),
        eq(user.flaggedInactive, false),
        eq(user.isAnonymized, false)
      )
    );

  if (due.length === 0) return;

  await db
    .update(user)
    .set({ flaggedInactive: true })
    .where(
      inArray(
        user.id,
        due.map((u) => u.id)
      )
    );

  const copy = buildInactivityWarningEmail();
  for (const u of due) {
    if (!u.email) continue;
    try {
      await sendNotificationEmail({
        to: u.email,
        userName: u.name ?? '',
        subject: copy.subject,
        body: copy.body,
        ctaUrl: copy.ctaUrl,
      });
    } catch (err) {
      console.error('[inactive] inactivity-warning email failed', u.id, err);
    }
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
pnpm --filter server test src/__tests__/jobs/inactive-handler.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/jobs/handlers/inactive.ts apps/server/src/__tests__/jobs/inactive-handler.test.ts
git commit -m "feat(server): send inactivity-warning email when flagging idle accounts"
```

---

### Task 6: Update tracking docs

Mark PR4 done and record the deferrals in the parent task doc and PROGRESS.

**Files:**

- Modify: `docs/project-management/M7-Notifications-Emails/M7-T4-Remaining-Matrix-Emails.md`
- Modify: `docs/project-management/PROGRESS.md`

- [ ] **Step 1: Update the parent task doc**

In `docs/project-management/M7-Notifications-Emails/M7-T4-Remaining-Matrix-Emails.md`, under `### PR 4 — GDPR + system emails`, add a status line at the top of that section:

```markdown
**Status (2026-06-24):** ✅ Shipped — `account-deleted` (S-06/A-18/V-17) wired into the
anonymise sweep; `inactivity-warning` (S-08) wired into the flag-inactive sweep (reuses
the `notification` template). **Deferred:** `data-export-ready` (S-07/A-19/V-18) — export
pipeline (`data-export.process`/`.notify`) still stubbed; X-01 admin reset — covered by the
existing `password-reset` template (admin shares the same BetterAuth instance).
```

In the `## Coverage check` list, change the `**PR 4:**` line to:

```markdown
- **PR 4 (shipped):** S-06/A-18/V-17 (account-deleted), S-08 (inactivity-warning). **Deferred:** S-07/A-19/V-18 (data-export-ready — pipeline stubbed), X-01 (covered by password-reset)
```

- [ ] **Step 2: Update PROGRESS.md**

In `docs/project-management/PROGRESS.md`, replace the M7-T4 line with:

```markdown
- [ ] M7-T4 · Remaining Matrix Emails — PR1 booking lifecycle (#136), PR2 outside-platform invite (#137), PR4 GDPR emails (account-deleted + inactivity-warning); PR3 (subscription lifecycle) pending on M8/Stripe
```

- [ ] **Step 3: Commit**

```bash
git add docs/project-management
git commit -m "docs(docs): mark m7-t4 pr4 gdpr emails shipped"
```

---

### Task 7: Full verification before PR

- [ ] **Step 1: Run all touched package test suites**

Run:

```bash
pnpm --filter @CeolX/email test && pnpm --filter @CeolX/shared test && pnpm --filter server test
```

Expected: all PASS.

- [ ] **Step 2: Confirm the `TS2741` dispatcher error stays gone**

Run:

```bash
pnpm exec turbo run check-types --filter=server --force 2>&1 | grep "TS2741" || echo "no TS2741 — good"
```

Expected: `no TS2741 — good`. (Pre-existing `TS2875` JSX errors remain — out of scope.)

- [ ] **Step 3: Confirm the build gate passes (the real pre-push check)**

Run:

```bash
pnpm exec turbo run build --filter=@CeolX/email --filter=@CeolX/shared --filter=server
```

Expected: all builds succeed (tsdown).

- [ ] **Step 4: Push and open the PR**

```bash
git push -u raftlabs feature/m7-t4-gdpr-emails
gh pr create --base development --repo Raft-Labs/CeolX \
  --title "M7-T4 PR4 — GDPR lifecycle emails (account-deleted + inactivity-warning)" \
  --body "Implements M7-T4 PR4 per docs/superpowers/specs/2026-06-24-m7-t4-pr4-gdpr-emails-design.md. Adds account-deleted (wired into GDPR anonymise sweep, captures email before erasure) and inactivity-warning (reuses notification template, wired into flag-inactive). Fixes the TS2741 email-dispatcher exhaustiveness break PR2 left behind. Defers data-export-ready (pipeline stubbed) and X-01 (covered by password-reset)."
```

---

## Notes for the implementer

- **TDD throughout:** every task writes the failing test first, watches it fail, then implements.
- **Both new emails are Category B (direct-send).** Neither is added to `EMAIL_TEMPLATES` / the queue dispatcher — `account-deleted` is sent from `account.ts`, `inactivity-warning` from `inactive.ts`.
- **`server#check-types` is red on `development` already** (pre-existing `TS2875 hono/jsx`). Do not chase it. Verify via the package-level `check-types`/`test` and the `TS2741`-specific grep instead.
- If a commit is blocked by commitlint, the subject must be **fully lowercase** (e.g. `gdpr`, `pr`, `tsc`) — see `commitlint.config.js`.
