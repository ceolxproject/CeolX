# M7-T4 · Remaining Matrix Emails (gap closure)

| Field          | Value                                                                                                                 |
| -------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Milestone**  | M7 — Notifications & Emails                                                                                           |
| **Status**     | 📝 Plan — not started                                                                                                 |
| **Depends on** | M7-T3 (✅ 6 transactional templates + transport), M7-T1 (push), M7-T2 (inbox), M5 (bookings), M8 (Stripe), M11 (GDPR) |
| **Source**     | M7-T0 Notifications Matrix (xlsx, rev 2) — the source of truth for which rows have an email surface                   |

---

## Why this task exists

The **M7-T0 matrix specs 38 V1 emails** (its own aggregate: Spectator 5, Artist 16, Venue 16, Admin 1). The only email _implementation_ task, **M7-T3, scoped just 6 templates** and closed as Done (PR #48): `verification`, `password-reset`, `venue-activation`, `payment-confirmation`, `event-approved`, `event-rejected` — exactly the 6 in `packages/email/src/registry.ts`. The `EmailTemplate` union is constrained to them, so nothing else can be dispatched today.

The remaining ~30 matrix email rows (booking lifecycle, outside-platform invite, subscription failure/cancellation, GDPR, admin) **never received an implementing task**. The notification layer was built email-_ready_ but email-_empty_: `TriggerDefinition.email` exists but is `null` everywhere, and `makeDispatchNotification` only fans out to push + inbox. The "pending M7-T3" comment in `triggers.ts` is a misattribution — M7-T3's scope never included trigger-driven emails.

This is a **scope/planning gap, not a regression**. The transport itself is healthy.

---

## P0 precondition (blocks _all_ email delivery — do first, independent of any template work)

Before building new templates, confirm the transport + sender are actually valid on staging and prod. No new template helps if these are wrong, and they're the likely reason even the 6 _built_ emails may not be arriving:

- `POSTMARK_API_TOKEN` set on **both** staging (preview) and prod Vercel envs. If unset and `APP_ENV`/`NODE_ENV` is not exactly `"production"`, `getTransport()` (`packages/email/src/client.ts:45`) silently routes to `localhost:1025` SMTP → mail vanishes with no error.
- `POSTMARK_FROM_ADDRESS` set on staging + prod, **and that exact sender signature/domain is verified (DKIM + SPF/Return-Path) in Postmark**. The sender is `admin@ceolx.com` (sending/legal domain; terms+privacy also live on `ceolx.com`). The app _infrastructure_ domain is `ceolx.com` (api/app/admin subdomains, deep links, `admin@ceolx.com`, `ceolx.com/subscribe`) — both domains are intentionally in play. **Latent footgun:** the two code fallbacks disagree — `packages/email/src/constants.ts:1` defaults to `admin@ceolx.com`, but `packages/env/src/server.ts:13` and `apps/server/.env.example:55` default to `noreply@ceolx.com`. `SENDER_EMAIL` reads `process.env.POSTMARK_FROM_ADDRESS` directly, so the env var wins at runtime; the `.com` fallback only applies if it's unset. Set the var explicitly to the verified address and align the two defaults to avoid a silent wrong-From if it's ever missing.
- Postmark account out of "pending approval" sandbox (new accounts can only send to the account's own domain until approved).
- Confirm the bounce/spam webhook (`/api/webhooks/postmark`) is wired in the Postmark dashboard so suppressed addresses are visible.

**Action:** trigger one _built_ email (verification or forgot-password) against staging and confirm receipt. If that fails, fix transport/sender before any T4 work.

---

## Implementation pattern (per the 6 existing templates)

Adding a template touches these files (grounded in the current codebase):

1. `packages/email/src/types.ts` — add key + data shape to `EmailTemplateMap`
2. `packages/email/src/templates/<name>.tsx` — React Email component
3. `packages/email/src/registry.ts` — register component (compile-time exhaustiveness enforces this)
4. `packages/email/src/subjects.ts` — subject builder
5. `packages/email/src/senders/<name>.ts` — business-level sender
6. `packages/email/src/index.ts` — export the sender
7. `apps/server/src/jobs/handlers/email.ts` — add dispatcher entry (the `email.send` job → typed sender)
8. **Call site** — one of three shapes:
   - **Auth-style (synchronous):** call the sender directly inside the request (how `verification`/`password-reset` work via BetterAuth hooks)
   - **Job-queue:** `publishJob('email.send', { to, template, data })` (QStash → webhook → `handleEmailSend`)
   - **Dispatcher fan-out:** route through `ctx.dispatchNotification` (push + inbox + email together)

`EMAIL_TEMPLATES` enum in `apps/server/src/jobs/types.ts` (`emailSendSchema`) must also gain any new key used via the job queue.

---

## Two categories (this drives correctness)

**Category A — trigger-driven notification emails.** Rows with Push/In-App **and** Email. Already pass through `ctx.dispatchNotification`. Add email by: (1) extending `makeDispatchNotification` to also publish `email.send` when `NOTIFICATION_TRIGGERS[trigger].email !== null`; (2) filling the reserved `email` SurfaceCopy in `triggers.ts` (copy is already drafted per row in the matrix). **No router changes.**

**Category B — email-only lifecycle.** Rows with Push/In-App = "—", Email = ✅. Must **not** go through `dispatchNotification` (it unconditionally writes an inbox row). Need a direct sender call at the event source (Stripe webhook handler, GDPR/inactivity job, etc.).

**Category C — outside-platform invite (A-14).** A mini-feature: template + invite token + `ceolx.com/invite/:token` claim landing + wiring into `bookings.inviteExternal`. The recipient has no account.

---

## PR breakdown

### PR 1 — Notification-email fan-out + booking lifecycle (Category A) — **START HERE (A-09)**

**Rows:** A-09 (invite→artist), A-10 (accepted), A-11 (rejected), A-12 (cancelled), V-09 (request→venue), V-10, V-11, V-12, V-13 (withdrawn). ~9 rows.

**Approach — one generic template, not 9 bespoke ones.** The matrix email bodies for bookings are uniform (greeting + 1–2 lines + single CTA to `/bookings/:id`). Add a single parametric `notification` template driven by the trigger's `email` `SurfaceCopy` (`{ title, body }`) + the route → CTA URL. This avoids 9 near-identical templates and keeps copy in `triggers.ts` (the matrix mirror).

**Work:**

- `EmailTemplateMap`: add `notification: { userName; subject; body; ctaUrl; ctaLabel }` (or similar)
- New `templates/notification.tsx` + registry + subject builder + sender
- Fill `email: { title, body }` for the 9 booking triggers in `packages/shared/src/notifications/triggers.ts` (copy from matrix A-09..A-12, V-09..V-13)
- Extend `makeDispatchNotification` (`apps/server/src/services/notifications-dispatcher.ts`): after the push step, if `email !== null`, resolve recipient email (join `users`) + `publishJob('email.send', { to, template: 'notification', data })`
- Add `notification` to `EMAIL_TEMPLATES` enum + `handleEmailSend` dispatcher
- Tests: dispatcher publishes an email job only when `email !== null`; built copy renders

**Why first:** highest leverage (9 rows, no router edits), and contains A-09 — the email you asked about.

### PR 2 — Outside-platform collaborator invite (A-14, Category C) — **second**

**Row:** A-14 — venue invites a non-platform artist by name+email. Matrix: route `ceolx.com/invite/:token`, 14-day expiry, subject _"{{inviterName}} added you to "{{eventTitle}}" on CeolX"_.

**Current state:** `bookings.inviteExternal` (`packages/api/src/routers/bookings.ts:1081`) only inserts an `eventCollaborators` row (`invitedName`/`invitedEmail`). No email, no token, no claim flow.

**Open design questions (needs brainstorming before build):**

- Token storage: new column on `eventCollaborators` (e.g. `inviteToken`, `inviteExpiresAt`) vs a dedicated invites table
- `ceolx.com/invite/:token` landing — HTTPS bridge into the app (like `verify-email`/`reset-password` in `apps/server/src/routes/`) → prefilled signup that claims the collaborator row on account creation
- What happens on expiry / re-invite / dedup (a dedup-by-email guard already exists)

**Work:** new `invite` template + sender; token column + 14-day expiry; `/invite/:token` route (model on `deep-link-bridge.ts`); claim-on-signup linking `eventCollaborators.artistProfileId`; wire `publishJob('email.send', …)` into `inviteExternal`.

**Flag:** this is net-new feature work — scope with `superpowers:brainstorming` first.

### PR 3 — Subscription lifecycle emails (Category A + B, M8-dependent)

**Rows:** A-03/V-03 activation (Stripe link), A-04/V-04 activation resend, A-05/V-05 activated, A-06/V-06 renewed, A-07/V-07 payment failed, A-08/V-08 cancelled.

**Work:**

- Generalize `venue-activation` → support Artist variant (A-03 has different plan copy); add resend preamble (A-04/V-04)
- Activate the currently-commented call site in `packages/api/src/routers/onboarding.ts:193`
- A-05/06, V-05/06 reuse the existing `payment-confirmation` template (Category A — they have push+inapp+email) → wire via dispatcher or Stripe webhook
- **New templates** `payment-failed` + `subscription-cancelled` (A-07/08, V-07/08) — Category B, email-only → direct sender call in the Stripe webhook handler (M8-T3), **not** via dispatchNotification

### PR 4 — GDPR + system emails (Category B, M11-dependent)

**Status (2026-06-24):** ✅ Shipped — `account-deleted` (S-06/A-18/V-17) wired into the
anonymise sweep; `inactivity-warning` (S-08) wired into the flag-inactive sweep (reuses
the `notification` template). **Deferred:** `data-export-ready` (S-07/A-19/V-18) — export
pipeline (`data-export.process`/`.notify`) still stubbed; X-01 admin reset — covered by the
existing `password-reset` template (admin shares the same BetterAuth instance).

**Rows:** S-06/A-18/V-17 account deletion complete, S-07/A-19/V-18 data export ready, S-08 inactivity warning, X-01 admin password reset.

**Work:**

- New templates: `account-deleted`, `data-export-ready`, `inactivity-warning`
- `data-export-ready`: the `data-export.notify` job already exists (`apps/server/src/jobs/types.ts`) — just needs the email body wired in
- `inactivity-warning`: wire into the `account.flag-inactive` job
- `account-deleted`: wire into the GDPR anonymize/cleanup job
- X-01 admin reset: variant of `password-reset` with separate sender domain + 30m TTL (matrix note) — confirm whether admin uses the same BetterAuth instance

---

## Coverage check (matrix rows → status after T4)

- **Built today (M7-T3):** S/A/V-01 verification, -02 reset, V-03 venue-activation (call site commented), A/V-05/06 payment (scaffold), A-15/V-14 event-removed
- **PR 1:** A-09/10/11/12, V-09/10/11/12/13
- **PR 2:** A-14
- **PR 3:** A-03/04, V-04, A-07/08, V-07/08 (+ activate A-05/06/V-05/06 wiring)
- **PR 4 (shipped):** S-06/A-18/V-17 (account-deleted), S-08 (inactivity-warning). **Deferred:** S-07/A-19/V-18 (data-export-ready — pipeline stubbed), X-01 (covered by password-reset)
- **Intentionally no email ("—"):** A-13/16, V-15, U-01..04 (push/in-app only — per matrix)
- **V2 (⏳):** S-03/04/05, A-17, V-16 (follow graph / feed — out of scope)

---

## Risks & decisions to confirm with PM (Pratiksha)

1. **Is the full 38-email set actually committed V1?** The matrix is "Draft rev 2 — pending PM audit." Some rows (e.g. booking-rejected emails) may be deliberately push/in-app-only to avoid email fatigue. Confirm the list before building.
2. **Generic vs bespoke template** for Category A (PR 1) — recommend generic.
3. **From-address** — sender is `admin@ceolx.com` (sending domain), app infra is `ceolx.com`; both are intentional. Align the two conflicting code defaults (`admin@ceolx.com` vs `noreply@ceolx.com`) and verify the configured sender in Postmark (P0 precondition).
4. **A-14 claim-flow design** — needs its own brainstorm.
