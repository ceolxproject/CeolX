# M8-T3 · Stripe Webhook & Subscription State Machine

| Field          | Value                                                                                                                              |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Milestone**  | M8 — Venue Subscription & Payments                                                                                                 |
| **Status**     | ✅ Implemented — local only, unmerged                                                                                              |
| **Decisions**  | `M8-T0-Subscription-Decisions.md` — **read first.** This task implements D-11, D-12, D-14, D-22, D-29, D-33…D-39, D-42, D-47, D-51 |
| **Depends on** | M8-T1 (SDK, env, schema, Checkout Session)                                                                                         |

---

## Description

Own the entire subscription state machine. The webhook is the **only** writer of subscription state (D-22) — no other code path may set a status.

Replaces the stub at `apps/server/src/routes/webhooks.ts:16`, which currently returns `{message:'not implemented'}`.

---

## Affected apps / packages

| App / package  | Role                                                                            |
| -------------- | ------------------------------------------------------------------------------- |
| `apps/server`  | `POST /api/webhooks/stripe` — raw Hono route, signature verified, no tRPC       |
| `packages/api` | Status write helper; Stripe → CeolX status mapping (D-12)                       |
| `packages/db`  | Writes to `venue_subscriptions` + the `venue_profiles` cache in one transaction |

---

## Scope

### 1 · Signature verification and raw body

Verify with `stripe.webhooks.constructEvent` against `STRIPE_WEBHOOK_SECRET`. Invalid signature → `400`, no processing. The route must read the **raw** body before anything parses it as JSON — follow the existing `rawBody` handling used by the Mux route in the same file.

### 2 · Re-fetch, don't trust the payload

On any subscription event, discard the payload's subscription object and call `subscriptions.retrieve(id)`, then write current truth.

This makes the handler idempotent and order-independent for free: a redelivered event writes the same result, and a `subscription.updated` arriving before `subscription.created` cannot corrupt state. It removes the need for a processed-events dedupe table entirely.

```
// ponytail: refetch instead of a dedupe table — idempotent and order-independent
```

### 3 · Events handled

Three code paths, not one per event.

| Event                                                     | Action                                                                                                                                                                                               |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `customer.subscription.created` / `.updated` / `.deleted` | One handler. Re-fetch, then write status, trial end date, period end, cancel-at-period-end, plan interval. Covers activation, trial→active, past_due, cancellation and reactivation                  |
| `invoice.payment_failed`                                  | Record `past_due_since` if not already set — this is the origin of the D-33 grace window (D-64)                                                                                                      |
| `invoice.paid`                                            | Clear `past_due_since`, refresh the period end, mark the activation token consumed, and queue the payment-confirmation email (D-64)                                                                  |
| `customer.subscription.trial_will_end`                    | Queue the trial-ending email (M8-T6). Stripe fires this ~3 days out; **our** email goes 7 days out per D-30, so M8-T6 schedules from `trial_ends_at` and this event is a safety net, not the trigger |
| `charge.dispute.created`                                  | D-51 — hide immediately and set `billing_blocked`                                                                                                                                                    |

`checkout.session.completed` is **not** handled. `customer.subscription.created` already carries everything, and handling both means two writers for one fact.

Payment-failure and card-update **emails** stay Stripe's (D-38) — but the invoice **events** are still handled, per D-64: `past_due_since` has to be recorded from the failure itself rather than inferred from a status transition, or the grace window has no honest start time.

### 4 · Status mapping

Per D-11 and D-12, one explicit mapping function, one place:

| Stripe                              | CeolX       |
| ----------------------------------- | ----------- |
| `trialing`                          | `trialing`  |
| `active`                            | `active`    |
| `past_due` / `unpaid`               | `past_due`  |
| `canceled`                          | `cancelled` |
| `incomplete` / `incomplete_expired` | `inactive`  |
| `paused`                            | `inactive`  |

Unmapped or future Stripe statuses must **fail loudly** in logs and leave state untouched. Never silently default to `active` or `inactive`.

### 5 · Grace period

D-33: 7 days, configurable. Stripe's own retry schedule is not the grace period — ours is measured from the first failure and read from `STRIPE_GRACE_DAYS`, so the client can change it without a deploy.

While inside the window the venue stays `past_due` and visible (D-13). At expiry the profile hides. Implement as a comparison at read time, **not** as a scheduled job that mutates status — a job introduces a second writer and breaks D-22.

### 6 · One fact, one write

D-14: `venue_subscriptions` is the source of truth and `venue_profiles.subscriptionStatus` is a cache. Both are written inside the **same transaction**, from this handler only. Nothing else in the codebase may write either column.

### 7 · Account deletion

D-47: the existing `account.anonymize` job in `apps/server/src/jobs/handlers/account.ts` must cancel the Stripe subscription in the same operation. Today it does not touch Stripe at all, so a deleted account keeps billing.

### 8 · Retry handler

`handleVenueSubscriptionRetry` in `apps/server/src/jobs/handlers/venue.ts` currently rejects with `Not implemented`. With §2's re-fetch approach this job has no remaining purpose — **delete it**, along with `venue.subscription-retry` from `jobs/types.ts` and its handler registration. Removing dead scaffolding beats implementing it.

---

## Acceptance criteria

- [ ] Tampered payload → `400`, nothing written
- [ ] Missing signature header → `400`
- [ ] Raw body reaches `constructEvent` unparsed
- [ ] Handler re-fetches from Stripe and ignores the payload's subscription object
- [ ] Redelivering the same event twice produces one identical result — no duplicate row, no duplicate email
- [ ] `subscription.updated` processed **before** `subscription.created` still lands correct state
- [ ] Trial start writes `trialing` + `trial_ends_at`; profile visible
- [ ] Trial→active transition writes `active`, `trial_ends_at` preserved (D-42 relies on it persisting)
- [ ] Cancel during trial keeps access until `trial_ends_at` (D-29)
- [ ] Failed charge writes `past_due`, profile stays visible through the configured grace window, hides after
- [ ] Recovery inside the window restores everything with no manual step (D-36)
- [ ] Retries exhausted → `cancelled` (D-37)
- [ ] Chargeback → hidden immediately and `billing_blocked` set (D-51)
- [ ] An unmapped Stripe status logs an error and changes nothing
- [ ] `venue_subscriptions` and the `venue_profiles` cache are written in one transaction and can never disagree
- [ ] Account deletion cancels the Stripe subscription; no invoice can be raised afterwards (D-47)
- [ ] `venue.subscription-retry` job, handler and schema entry removed
- [ ] Grace period is read from configuration, not hardcoded, and no scheduled job mutates subscription status

---

## Dependencies

- **Upstream**: M8-T1
- **Downstream**: M8-T2 (reads status), M8-T4, M8-T5, M8-T6
- **External**: Stripe

---

## Notes

**Test with the Stripe CLI**, not hand-rolled fixtures — `stripe trigger customer.subscription.updated` and friends. Trial-end and grace-expiry paths need Stripe test clocks; a 183-day trial cannot be waited out.

**The webhook endpoint must be unauthenticated** and excluded from any auth middleware, or Stripe receives a 401 and silently retries into oblivion.

The previous version of this document specified `invoice.payment_succeeded` / `invoice.payment_failed` / `customer.subscription.deleted` as three separate handlers with per-event idempotency checks, plus ~280 lines of sample code. The re-fetch approach in §2 makes the idempotency bookkeeping unnecessary, so that structure was removed rather than updated.
