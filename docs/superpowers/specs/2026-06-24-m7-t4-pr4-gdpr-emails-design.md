# M7-T4 PR4 — GDPR lifecycle emails (design)

| Field           | Value                                                                                     |
| --------------- | ----------------------------------------------------------------------------------------- |
| **Parent task** | `docs/project-management/M7-Notifications-Emails/M7-T4-Remaining-Matrix-Emails.md` (PR 4) |
| **Date**        | 2026-06-24                                                                                |
| **Status**      | Design approved — ready for implementation plan                                           |
| **Base branch** | `development` (includes M7-T4 PR1 #136 + PR2 #137)                                        |
| **Branch**      | `feature/m7-t4-gdpr-emails`                                                               |

---

## Goal

Ship the two GDPR lifecycle emails that can be wired **end-to-end** today, and fix a
build break PR2 left in the server email dispatcher.

In scope:

- **`account-deleted`** (matrix S-06 / A-18 / V-17) — sent when an account's data is
  anonymised by the GDPR erasure sweep.
- **`inactivity-warning`** (matrix S-08) — sent when an account is flagged inactive
  after 24 months of no login.
- **Dispatcher build-break fix** — re-key the `email.send` dispatcher to the queue-able
  template subset so direct-send-only templates (`collaborator-invite`, `account-deleted`)
  no longer break `tsc -b`.

Explicitly **out of scope** (deferred, recorded in the parent task doc):

- **`data-export-ready`** (S-07 / A-19 / V-18) — the export pipeline
  (`data-export.process` / `.notify`) is stubbed (`reject('Not implemented')`); there is
  no real trigger to attach an email to. Defer to the future M11 data-export task.
- **X-01 admin password reset** — admin shares the **same** BetterAuth instance
  (`apps/admin/src/lib/auth-client.ts` → `VITE_SERVER_URL`); there is no separate admin
  auth and no admin reset UI. The existing `password-reset` template already serves it.
  The matrix "separate domain + 30m TTL" note cannot be done per-role without forking
  BetterAuth's global reset-token TTL — not worth it for V1.

---

## Why these two are the live ones

PR4's four row-groups were assumed equal by the parent task doc. They are not:

| Email                | Wireable now? | Finding                                                                                                                                                  |
| -------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `account-deleted`    | ✅ Yes        | Wire into the anonymise sweep. `applyAnonymization` overwrites the email to `{userId}@deleted.ceolx.ie`, so capture the real address **before** erasing. |
| `inactivity-warning` | ✅ Yes        | `account.flag-inactive` works; send the warning to newly-flagged users.                                                                                  |
| `data-export-ready`  | ⚠️ Partial    | `data-export.process` AND `.notify` are stubs that reject. No working trigger. Deferred.                                                                 |
| X-01 admin reset     | ⚠️ Covered    | Admin shares the same BetterAuth instance; existing `password-reset` already covers it. Deferred.                                                        |

---

## Components

### 1. `account-deleted` — bespoke template (Category B, direct-send)

Category B = email-only (no push, no inbox row), so it is sent by a **direct sender call**
at the event source, never through `dispatchNotification`.

Files (mirrors the existing per-template pattern):

1. `packages/email/src/types.ts` — add `'account-deleted': { userName: string }` to
   `EmailTemplateMap`. No CTA, no links — the account no longer exists.
2. `packages/email/src/templates/account-deleted.tsx` — confirmation copy
   (heading per matrix S-06: _"Your CeolX account has been deleted"_; body confirms the
   account and personal data are gone and that this is final). Uses the same
   `userName || 'there'` greeting fallback as `venue-activation`.
3. `packages/email/src/registry.ts` — register the component (compile-time exhaustiveness).
4. `packages/email/src/subjects.ts` — subject builder → _"Your CeolX account has been deleted"_.
5. `packages/email/src/senders/account-deleted.ts` — `sendAccountDeletedEmail({ to, userName })`.
6. `packages/email/src/index.ts` — export the sender.

### 2. `inactivity-warning` — reuses the generic `notification` template

No new template/type/sender. The flag-inactive handler calls the existing
`sendNotificationEmail({ to, userName, subject, body, ctaUrl })` directly.

- Copy lives as a small builder in `@CeolX/shared` (honours "email copy in shared").
  It is **not** a `triggers.ts` row — it is email-only and not a notification trigger,
  so it sits in its own shared module rather than the trigger matrix.
- Subject + body copy are taken verbatim from matrix row S-08 during implementation;
  the design assumes a reminder subject (e.g. _"We miss you at CeolX"_) and a body that
  states the account has been idle ~24 months and to log in to keep it.
- CTA → app landing (`EXPO_PUBLIC_SHARE_BASE_URL` / `ceolx.ie`).

---

## Wiring

### `account-deleted` → `applyAnonymization` (`apps/server/src/jobs/handlers/account.ts`)

`applyAnonymization(userId)` is the single source of truth for erasure, shared by the
per-user handler and the daily sweep. The transaction overwrites `email`/`name`, so:

1. **Before** the transaction: `SELECT email, name FROM user WHERE id = userId`.
2. Run the existing erasure transaction unchanged.
3. **After** the transaction commits: `sendAccountDeletedEmail({ to: capturedEmail, userName: capturedName })`.

Constraints:

- Erasure is the priority. The send is wrapped in `try/catch`; a failure is logged and
  **never** rolls back the deletion (R8.5 non-blocking).
- Skip the send if the captured email is missing or already a `@deleted.ceolx.ie` address
  (defensive — callers already guard on `isAnonymized`).
- Centralising the send in `applyAnonymization` covers both callers automatically.

### `inactivity-warning` → `handleAccountFlagInactive` (`apps/server/src/jobs/handlers/inactive.ts`)

Currently a single bulk `UPDATE ... SET flaggedInactive = true WHERE <predicate>`. Change to:

1. `SELECT id, email, name` for due rows (`lastLoginAt < cutoff AND NOT flaggedInactive AND NOT isAnonymized`).
2. `UPDATE flaggedInactive = true` for those ids.
3. For each, `sendNotificationEmail(...)` with the inactivity copy + CTA.

Order is **flag-then-send = at-most-once**: a failed send is logged, not retried, so the
same user is never re-warned on the next daily run. Each send is non-blocking; one
failure does not abort the sweep.

### Dispatcher build-break fix (`apps/server/src/jobs/handlers/email.ts`)

Adding `account-deleted` to the `EmailTemplate` union means the dispatcher's
`Record<EmailTemplate, Dispatch>` would demand entries for both `collaborator-invite`
(PR2) and `account-deleted` — all direct-send-only templates. PR2 already left this map
non-exhaustive (`collaborator-invite` missing) → `tsc -b` breaks on `development`.

Fix: re-key the map to the **queue-able** subset.

- In `apps/server/src/jobs/types.ts`, export a type from the existing `EMAIL_TEMPLATES`
  const: `export type QueueableEmailTemplate = (typeof EMAIL_TEMPLATES)[number];`.
- In `email.ts`, type the map as `Record<QueueableEmailTemplate, Dispatch>`.
- Update the stale comment in `types.ts`: direct-send-only templates
  (`collaborator-invite`, `account-deleted`) are intentionally absent from the queue list.

The map's existing 7 entries already equal `EMAIL_TEMPLATES`, so only the annotation
changes — no runtime change.

---

## Error handling

- All email sends in job handlers are non-blocking (`try/catch`, log, continue) so a mail
  failure never breaks GDPR erasure or the inactivity sweep (R8.5).
- `account-deleted`: erasure transaction is independent of and prior to the send.
- `inactivity-warning`: at-most-once; failures are not retried.

---

## Decisions baked in

- **inactivity-warning goes to all newly-flagged users** (role-agnostic copy), not just
  spectators — a 24-month-idle account of any role gets the warning.
- **account-deleted is sent to the original captured email**, used transiently and never
  re-stored. A deletion confirmation is a legitimate transactional message post-erasure.
- **No queue path** for either new email — both are Category B direct-send.

---

## Testing (TDD — tests written first)

**`packages/email`**

- `account-deleted` template renders the userName and falls back to `there` when empty.
- subject builder returns the matrix S-06 subject.
- `sendAccountDeletedEmail` dispatches `template: 'account-deleted'` with `{ userName }`.

**`apps/server` — account handler**

- Captures the original email/name before erasure and sends `account-deleted` to it
  after the transaction commits.
- A send failure does not abort or roll back erasure (row still anonymised).
- An already-anonymised / cleared row sends nothing (existing idempotency preserved).

**`apps/server` — inactive handler**

- Flags due users and sends one inactivity warning per newly-flagged user.
- A send failure does not abort the sweep (remaining users still processed/flagged).
- Already-flagged or anonymised users get nothing.

**Dispatcher**

- Type-level: `tsc -b` on `apps/server` is green — the `collaborator-invite` /
  `account-deleted` exhaustiveness break is gone.

---

## Coverage delta (parent task doc)

- **PR 4 (this):** S-06 / A-18 / V-17 (`account-deleted`), S-08 (`inactivity-warning`).
- **Deferred:** S-07 / A-19 / V-18 (`data-export-ready` — export pipeline stubbed),
  X-01 (admin reset — covered by `password-reset`).
