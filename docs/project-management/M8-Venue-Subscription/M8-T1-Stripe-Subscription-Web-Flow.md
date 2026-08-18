# M8-T1 · Stripe Foundation, Activation Token & Checkout

| Field          | Value                                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------- |
| **Milestone**  | M8 — Venue Subscription & Payments                                                                            |
| **Status**     | ✅ Implemented — local only, unmerged                                                                         |
| **Decisions**  | `M8-T0-Subscription-Decisions.md` — **read first.** This task implements D-04…D-24, D-49, D-60, D-61          |
| **Depends on** | M2-T4 (venue persona), M7-T3 (Postmark), M1-T13 (QStash jobs)                                                 |
| **Blocked by** | Nothing. O-08 closed 18/08/2026 as **D-67** — the gate now waits on the manual email campaign, not a decision |

---

## Description

Stand up everything needed for a venue to go from `inactive` to `trialing`: the Stripe SDK and configuration, the schema changes the trial requires, the one-time activation token, and the Checkout Session.

This task deliberately stops at "Checkout Session created". Consuming the result is M8-T2 — the webhook is the only source of truth (D-22), so nothing here writes subscription state.

---

## Affected apps / packages

| App / package     | Role                                                                                                |
| ----------------- | --------------------------------------------------------------------------------------------------- |
| `packages/db`     | Migration: `trialing` status, trial end date, plan interval, nullable Stripe ids, activation tokens |
| `packages/shared` | `SUBSCRIPTION_STATUSES` + the visibility predicate (D-13)                                           |
| `packages/api`    | `stripe.createCheckoutSession`, `venues.requestActivation`                                          |
| `packages/env`    | Server-side Stripe configuration                                                                    |
| `apps/server`     | `GET /activate?token=…` — validates and 302s to Stripe (D-60)                                       |

---

## Scope

### 1 · Stripe SDK and configuration

The `stripe` package is not installed anywhere in the monorepo today, and no server-side Stripe env vars exist.

- Install `stripe` in `packages/api`.
- Add to `packages/env/src/server.ts`: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_ANNUAL`, `STRIPE_TRIAL_DAYS` (default `183`, D-06). No `STRIPE_GRACE_DAYS` — the grace window is Stripe's retry schedule since D-33 was revised on 18/08/2026.
- Test keys for local and staging, live keys only in production. Both price ids differ per environment.

### 2 · Schema migration

Per D-07, D-10, D-14 and the columns D-29 / D-42 depend on:

- `SUBSCRIPTION_STATUSES` gains `trialing` (`packages/shared/src/enums.ts:54`) — the pgEnum in `packages/db/src/schema/enums.ts` follows.
- `venue_subscriptions.plan` becomes the billing interval (`monthly` \| `annual`), replacing the `'lite'` default left over from the abandoned tier model.
- `venue_subscriptions.trial_ends_at` — required by D-29 (access until trial end after cancelling) and D-42 (one trial ever; a non-null value means the trial is spent, so no separate `trial_used` column).
- `venue_subscriptions.cancel_at_period_end` — required by D-39.
- `venue_subscriptions.stripe_customer_id` and `stripe_subscription_id` become **nullable**. They are `NOT NULL` today, but D-21 requires reusing a customer that exists before any subscription does.
- `venue_subscriptions.billing_blocked` — D-51 chargeback block. Ships here so M8-T3's webhook has somewhere to write; the admin screen to clear it is deliberately deferred (D-62), so until then unblocking is a manual DB update.
- Drop `venue_profiles.is_active` per D-14. Read sites to update: `venues.byId`, `venues.list`, `profiles.ts`, `follows.ts`, `admin/users.ts`. Leave `artist_profiles.is_active` alone — different meaning entirely.

### 3 · Visibility predicate

> ⚠️ **This is the cutover.** Every venue row in production is `subscription_status = 'inactive'` — the column default, never written, because the webhook was a stub. Their profiles are live today because `VENUE_GATE_ENABLED` is off, not because of anything in that column, so switching the gate on hides **every venue on the platform** at once. **D-67 is how that is avoided:** no row is back-filled, and the gate stays off until every existing venue has been emailed by hand and had the chance to activate — at which point their own six months starts. The gate is a deploy-time operation, not a code branch.

`isProfileVisibleToViewer` in `packages/api/src/routers/_profile-helpers.ts:76` currently ends `return true; // venue: gate disabled`.

Restore it per D-13 — but it returns a **state**, not a boolean, because D-52 needs "on hold" to be distinguishable from "does not exist". Callers render different copy for each. Every existing caller must be updated in this task; leaving one on a boolean reintroduces the neutral-unavailable bug D-52 exists to prevent.

### 4 · Activation token

Per D-17, D-18, D-19. New table: id, user id, token hash, expiry, consumed-at.

- Store a **hash**, never the raw token.
- Expiry from configuration, default 45 minutes inside D-17's 30–60 minute window.
- Issuing a new token invalidates every outstanding token for that user (D-18).
- Consumed on successful payment, not on page load — D-24 requires the link to survive an abandoned page.
- `venues.requestActivation` issues a token, queues the email, and is rate-limited on the existing Layer-2 Redis pattern from M1-T7. Use a **dedicated** bucket key, not a shared one.

### 5 · Token validation and Checkout Session

Per **D-60** there is no page to build. `GET api.ceolx.com/activate?token=…` validates the token and **302s straight to the Stripe Checkout URL**. Only the failure states (`expired` / `consumed` / `invalid`) and the post-checkout return need markup, and those can be minimal — enough to carry D-24's messaging and a request-a-fresh-link button.

⚠️ **Do not add `/activate` to `LINK_PATH_GLOBS`** in `apps/server/src/routes/app-links.ts` (currently `/post/*`, `/event/*`, `/u/*`) or to `intentFilters` in `apps/native/app.config.js`. Both are correctly scoped today, so the activation link opens the browser as intended. Widening either to `/*` would make the email open the **app** instead of the payment page and silently kill the only route into the paid flow. Leave a comment at both sites saying so.

- `stripe.createCheckoutSession` builds the session per D-21, with `subscription_data.trial_period_days` from `STRIPE_TRIAL_DAYS`. Card collection is Checkout's default — no extra parameter.
- The billing interval comes from the `plan` query parameter (D-08), validated against a two-value allowlist and mapped to `STRIPE_PRICE_MONTHLY` / `STRIPE_PRICE_ANNUAL` server-side. A Price ID is never read from the URL.
- Guard per D-49: refuse when the venue already has a `trialing`, `active` or in-progress subscription, and refuse when `billing_blocked` is set (D-51).
- Trial eligibility per D-42: pass the trial only when no trial end date has ever been recorded.

---

## Acceptance criteria

- [ ] `stripe` installed; all Stripe env vars validated at boot; boot fails loudly if a required key is missing
- [ ] Migration applied: `trialing` present, plan interval, `trial_ends_at`, `cancel_at_period_end`, `billing_blocked`, Stripe ids nullable, `venue_profiles.is_active` dropped and all read sites updated
- [ ] `isProfileVisibleToViewer` returns a three-way state and every caller renders the correct one; no caller treats "on hold" as "not found"
- [ ] Manual activation email sent to every existing venue **before** the gate reaches production (D-67 — no back-fill, their trial starts when they activate)
- [ ] `/activate` absent from `LINK_PATH_GLOBS` and `intentFilters`, with a comment at both sites explaining why
- [ ] Requesting activation issues a token, emails it, and invalidates all previous tokens for that user
- [ ] Only the newest link works; an older link returns `invalid`, not a server error
- [ ] Token hash is stored — the raw token appears nowhere in the database or logs
- [ ] Expired token returns `expired`; the page can request a fresh link
- [ ] Opening the link and abandoning the page leaves the token usable until expiry
- [ ] Checkout Session carries `client_reference_id`, metadata, prefilled email, trial days, and reuses an existing customer id when present
- [ ] Stripe Prices created with `tax_behavior: 'inclusive'` (D-61) — verified before the live Prices exist, since it cannot be changed afterwards
- [ ] A valid token 302s straight to Stripe with no intermediate page
- [ ] A venue with a `trialing` / `active` subscription cannot create a second session
- [ ] A venue that already consumed its trial gets a session with **no** trial
- [ ] A `billing_blocked` venue cannot create a session
- [ ] Rate limit on activation requests uses its own bucket and is verified on staging
- [ ] No price, URL, or checkout button anywhere in `apps/native` (D-16)

---

## Dependencies

- **Upstream**: M2-T4, M7-T3, M1-T13, M1-T7 (rate-limit pattern)
- **Downstream**: M8-T2 (consumes the session), M8-T3, M8-T4, M8-T5, M8-T6
- **External**: Stripe, Postmark

---

## Notes

**Raw body for signature verification** is an M8-T2 concern, but note now that `apps/server/src/routes/webhooks.ts` already types a `rawBody` variable for the Mux route — follow that pattern rather than inventing a second one.

**Do not reuse the old task's code snippets.** The previous version of this document contained sample code assuming a Next.js app router (`apps/admin` is Vite + TanStack Router), importing `@ceolx/db` (real: `@CeolX/db`), writing a `venueProfileId` column that does not exist (real: `venueId`), and quoting €29.99 for a "CeolX Pro" plan. All of it was wrong. Deleted rather than corrected.
