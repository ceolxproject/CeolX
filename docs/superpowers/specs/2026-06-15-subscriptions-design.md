# CeolX Subscriptions — Design Spec

**Date:** 2026-06-15
**Author:** Priya Yadav (with Claude)
**Status:** Approved design — ready for implementation plan
**Asana refs:** M8 (subscriptions), 1215188774672224 (activation email disabled), 1215489113550392 (visibility gate disabled)

---

## 1. Goal

When an Artist or Venue onboards, their profile is **not visible** and they **cannot publish events or posts** until they hold an active paid subscription. Subscription is purchased on a **web page** (`ceolx.com/subscribe`) via **Stripe Payment Links**, managed/cancelled via the **Stripe-hosted Customer Portal**, and the mobile app learns the result **solely from a Stripe webhook** that updates a cached status column. The app never talks to Stripe and never links to checkout (Apple Rule 3.1.1).

## 2. Core principle — the app is a read-only observer

One-way data flow, three decoupled systems sharing only a database column:

```
[Mobile app]  --reads-->  profile.subscriptionStatus  <--writes ONLY--  [Stripe webhook]
                                                                              ▲
[ceolx.com/subscribe] --opens--> [Stripe Payment Link] --user pays--> Stripe
```

- The mobile app and the marketing/subscribe site share **no link and no API call**.
- `subscriptionStatus` is a **denormalized cache**; the Stripe webhook is its **only writer** (this is already documented in the schema).
- Cancellation, plan change, and refunds all originate **outside the app** (Stripe Customer Portal / Stripe Dashboard) and propagate back through the same webhook.

## 3. Decisions (locked)

| Decision                 | Choice                                                                                                                                                                 |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scope                    | **Both Artist and Venue, at parity** via a **single shared `subscriptions` table keyed by `userId`** (no per-role duplication; safe because one account = one persona) |
| Checkout                 | **Stripe Payment Links** (no backend session, no web login)                                                                                                            |
| Manage / cancel / refund | **Stripe Customer Portal** (hosted login link with `prefilled_email`); refunds issued by admin in Stripe Dashboard                                                     |
| Publish gating           | **Block publish, allow drafts** (events: draft allowed, `active` blocked; posts: creation blocked — no draft state)                                                    |
| Web /subscribe auth      | **No login — signed link** (email link carries `role` + `profileId` + HMAC `sig`)                                                                                      |
| App status refresh       | **Refetch on focus** (React Query refetch on app/screen focus + pull-to-refresh; no sockets)                                                                           |
| Domain                   | **ceolx.com** (per instruction; code/CLAUDE.md currently say `ceolx.com` — see §11)                                                                                    |

## 4. Data model changes

### 4.0 Single unified `subscriptions` table (keyed by `userId`)

The billing table is **shared by both roles** rather than duplicated per persona. This is safe because of the core CeolX invariant: **one account = exactly one persona** (artist _or_ venue, never both — role switching is not supported). So the subscriber is unambiguously the `userId`, and we keep a real enforced FK to `users` (a polymorphic `subscriber_type/subscriber_id` table would lose that). The role is always recoverable via `users.current_role`.

- **Repurpose the existing `venue_subscriptions` table → `subscriptions`** (rename; re-key from `venue_id` to `user_id`):
  - `id uuid PK`
  - `user_id uuid` — **unique** FK → `users`, cascade delete (one subscription per account)
  - `role` — `userRoleEnum` snapshot (`artist | venue`) for convenience/auditing (derivable from `users.current_role`, but cheap to store)
  - `stripe_customer_id varchar`
  - `stripe_subscription_id varchar`
  - `plan varchar` (tier name; not an enum, to avoid migration churn while tiers are finalized)
  - `status subscriptionStatusEnum`
  - `current_period_start timestamp`, `current_period_end timestamp`
  - `created_at`, `updated_at`
  - one-to-one relation `users → subscriptions`
- **No separate `artist_subscriptions` table.** Re-key the relation off `users`.
- Reuse the existing `subscriptionStatusEnum` = `inactive | active | past_due | cancelled` for both roles.

### 4.1 Keep the cheap denormalized cache on each profile table

The 2-column read-cache stays **per-profile** (it is _not_ unified) — the visibility gate and the map/discovery filters read it on hot paths, and the whole point of the cache is to avoid joining the billing table on every map query.

- **`venue_profiles`** already has `subscription_status` + `stripe_customer_id` + `is_active` — unchanged.
- **`artist_profiles`** — add to match:
  - `subscription_status` — `subscriptionStatusEnum`, `NOT NULL DEFAULT 'inactive'`
  - `stripe_customer_id` — `varchar(255)`, nullable
  - `is_active` — change default from `true` → `false` (artists currently go live instantly, which contradicts "not visible until subscribed")

The webhook is the only writer of both the `subscriptions` row **and** the profile cache; it keeps them in sync atomically.

### 4.2 Migration / backfill note

Flipping `artist_profiles.is_active` default to `false` affects **new** rows only. Existing artist rows in dev/staging must get an explicit backfill decision (leave active vs. force inactive). Production has no live artists yet, so this is a dev/staging-only concern. Decide at migration time.

## 5. End-to-end flow

```
1. User signs up → picks Artist or Venue → completes onboarding
     → profile row: subscription_status='inactive', is_active=false
     → profile NOT visible to others; CANNOT publish events/posts
2. Backend sends Postmark activation email (re-enable the commented-out block in onboarding.ts)
     → link: https://ceolx.com/subscribe?role=<venue|artist>&uid=<userId>&email=<email>&sig=<hmac>
       (role drives which plans render; uid becomes the Payment Link client_reference_id)
3. Mobile app shows existing banner: "Profile not visible. Check your email to activate."
     + working "Resend Email" button (new tRPC mutation)
4. User opens email → ceolx.com/subscribe
     → page validates sig, reads role, renders the correct plan set (venue tiers OR artist tier)
     → each "Subscribe" button = a Stripe Payment Link URL with:
          ?client_reference_id=<userId>&prefilled_email=<email>
5. User completes payment on Stripe's hosted page (no CeolX login on web)
6. Stripe → POST /api/webhooks/stripe → handler:
     - checkout.session.completed:
         * parse client_reference_id → userId; load user → current_role → target profile
         * store session.customer as profile.stripe_customer_id (and on the subscriptions row)
         * upsert the single subscriptions row (keyed by userId) → status='active'
         * set profile.subscription_status='active', profile.is_active=true
         * send payment-confirmation email (includes Customer Portal "Manage billing" link)
7. Mobile app refetches profile on next focus / pull-to-refresh
     → status='active' → banner gone, profile visible, publishing unlocked
```

## 6. Identity linking — the critical mechanism

Payment Links have **no logged-in session**, so `client_reference_id` is the **only** thread tying a payment to a CeolX account. Because the billing table is keyed by `userId`, the reference is just the **`userId`** — no role/profile prefix needed (role is recovered from `users.current_role`).

- The activation email bakes `client_reference_id=<userId>` into each Payment Link URL.
- On `checkout.session.completed`, the webhook:
  1. parses `client_reference_id` → `userId`, loads the user → `current_role` → the target profile (artist or venue),
  2. reads `session.customer` and stores it as `profile.stripe_customer_id` **and** on the `subscriptions` row (the durable link for all future events),
  3. upserts the single `subscriptions` row (keyed by `userId`) and activates the profile cache.
- **All later events** (`customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, `invoice.paid`) carry only `customer`, so the handler resolves the subscription by the stored `stripe_customer_id`, then the profile via its `userId` + `role`.

### 6.1 Tamper resistance

The email link includes an **HMAC `sig`** over `userId|email` using a server secret. The `/subscribe` page rejects mismatched links. This is defense-in-depth; the webhook remains the source of truth (it only activates a `profileId` that actually exists).

### 6.2 Accepted edge case

Stripe Payment Links create a **fresh Stripe customer per checkout**, so a user who pays twice could spawn a duplicate customer. At launch scale (<1,000 users) this is negligible — documented, not engineered around. The Customer Portal `prefilled_email` still finds their customer(s) for management.

## 7. Gating — two enforcement points

### 7.1 Profile visibility (read side)

- **Venue:** re-enable the gate already stubbed in `venues.byId` — return `NOT_FOUND` for non-owners when `subscription_status !== 'active'`. The **owner always sees their own profile** (so the activation banner can render).
- **Artist:** add the identical owner-aware gate to the artist profile read path.
- **Discovery search:** keep/extend the existing `subscription_status = 'active'` filter for both roles (venues already filtered; add artist once the column exists).

### 7.2 Publish gating (write side) — net-new

No subscription check exists on `events.create` / `posts.create` today. Add a `subscribedCreatorProcedure` (extends `creatorProcedure`) that asserts the caller's profile is `active`.

- **Events:** an inactive creator **may save a `draft`** but **cannot publish to `active`** (or `pending_review`). The procedure permits the create call when the resulting status is `draft`; it rejects when the target status is a published state. Returns `FORBIDDEN` with a "Activate your subscription to publish" message the app surfaces.
- **Posts:** posts have **no draft concept** today, so an inactive creator is **blocked from creating posts** entirely (same `FORBIDDEN`). We do **not** invent a post-draft state in this scope.

## 8. Manage / cancel / refund — Stripe Customer Portal (zero billing code)

- A Stripe-hosted **Customer Portal login link** (configured once in the Stripe dashboard; pattern proven in WendorPro) surfaced **only outside the app**:
  - in the **payment-confirmation email**, and
  - on **ceolx.com/subscribe** as a "Manage billing" button,
  - opened with `?prefilled_email=<email>`.
- **Cancellation** in the Portal → Stripe fires `customer.subscription.deleted` (or `updated` with cancel-at-period-end) → webhook flips `subscription_status`/`is_active` → profile hidden + publishing re-locked.
- **Refunds** are **not** self-serve in the Portal — issued by admin in the **Stripe Dashboard**; the resulting webhook still updates our state.
- No custom billing UI, no `billingPortal.sessions.create` API call required.

## 9. Webhook event handling

Endpoint: `POST /api/webhooks/stripe` (Hono route already reserves `rawBody`). Verify with `stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET)`.

| Event                           | Action                                                                                                                                                                                |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `checkout.session.completed`    | Parse `client_reference_id` (=`userId`); store `stripe_customer_id`; upsert the `subscriptions` row; set profile `status='active'`, `is_active=true`; send payment-confirmation email |
| `customer.subscription.updated` | Resolve `subscriptions` row by `stripe_customer_id` → profile; sync `status`, `current_period_*`, plan; handle scheduled cancel                                                       |
| `customer.subscription.deleted` | Resolve by customer; `status='cancelled'`, profile `is_active=false`                                                                                                                  |
| `invoice.payment_failed`        | `status='past_due'` (profile stays as configured; see open question §11)                                                                                                              |
| `invoice.paid`                  | Renewal confirmation; ensure `status='active'`, refresh period end                                                                                                                    |

Webhook handler is **idempotent** (Stripe retries): upserts keyed by `stripe_subscription_id` / `stripe_customer_id`; ignore stale events by comparing period timestamps. The `subscriptions` row and the profile cache are written in the **same transaction**.

## 10. Touch points by package

- **`packages/db`** — rename/re-key `venue_subscriptions` → `subscriptions` (FK `user_id`, add `role`); add the 2 cache columns to `artist_profiles` (+ flip `is_active` default); update relations; drizzle migration.
- **`packages/api`**
  - `routers/onboarding.ts` — re-enable activation email for venue; add it for artist; build signed `activationUrl`.
  - new `subscriptions` router (or extend `stripe`) — `resendActivationEmail` mutation (wired to the app's existing "Resend Email" button).
  - `routers/stripe.ts` — remove the unused `createCheckoutSession` stub (Payment Links replace it) **or** repurpose; confirm at plan time.
  - `routers/venues.ts` / artist read path — re-enable + add visibility gate.
  - `routers/events/crud.ts`, `routers/posts/crud.ts` — `subscribedCreatorProcedure` gating.
  - `routers/discovery.ts` — add artist subscription filter.
  - shared activation-link signer/verifier util + HMAC secret.
- **`apps/server`**
  - `routes/webhooks.ts` — implement `/stripe` (signature verify + event handlers).
  - install `stripe` SDK; add `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, Payment Link URLs/price IDs, Customer Portal URL, HMAC secret to env schema (`packages/env/src/server.ts`).
- **`apps/admin`** — new public `/subscribe` route: validate `sig`, render role-appropriate plans, append `client_reference_id` + `prefilled_email` to Payment Links, show "Manage billing" portal link. `VITE_STRIPE_*` config as needed (publishable key already present).
- **`apps/native`**
  - wire existing "Resend Email" button → `resendActivationEmail`.
  - ensure profile query **refetches on focus** + pull-to-refresh so status flips propagate.
  - add the same activation banner to the **artist** profile screen (venue already has it).
  - ensure publish actions surface the `FORBIDDEN` "activate to publish" message gracefully.
- **`packages/email`** — templates exist (`venue-activation`, `payment-confirmation`); add/clone an **artist-activation** variant if copy differs; otherwise reuse with role-aware data.

## 11. Open questions / flags

1. **Domain:** spec uses `ceolx.com`; code + CLAUDE.md + deep-link memory use `ceolx.com` for the admin SPA. Confirm which domain actually serves `apps/admin` in staging/prod, and align the activation/portal URLs + universal-link config accordingly.
2. **`past_due` behavior:** on `invoice.payment_failed`, do we hide the profile immediately, or keep it visible during Stripe's retry/grace window and only hide on final `deleted`? Default assumption: **keep visible during `past_due`, hide on `cancelled`** — confirm.
3. **Artist `is_active` backfill** for existing dev/staging artist rows (§4.2).
4. **Plan catalog:** number of venue tiers (Lite/Pro?) and the single artist tier, their Stripe Price IDs / Payment Link URLs, and copy — needed before the `/subscribe` page is final (Open Item #2, client post-launch).
5. **Resend rate-limit:** the "Resend Email" mutation should be throttled (e.g. 1/min) to avoid Postmark abuse.

## 12. Out of scope (V1)

- In-app purchasing of any kind (Apple/Google billing) — web-only by design.
- Custom billing UI / self-serve refunds in the app or on ceolx.com.
- Realtime push for status change (refetch-on-focus is sufficient).
- Proration UX, trials (unless a tier defines one — handled by Stripe if so).
- Multi-subscription per account, role switching (separate accounts per CLAUDE.md).
