# M8-T4 · Manage Subscription — Emailed Portal Link

| Field          | Value                                                                                                 |
| -------------- | ----------------------------------------------------------------------------------------------------- |
| **Milestone**  | M8 — Venue Subscription & Payments                                                                    |
| **Status**     | 🔲 To Do                                                                                              |
| **Decisions**  | `M8-T0-Subscription-Decisions.md` — **read first.** This task implements D-16, D-39, D-41, D-43, D-45 |
| **Depends on** | M8-T1 (Stripe SDK + customer id), M8-T3 (status)                                                      |

---

## Description

Let a subscribed venue manage billing. **We build no billing screens** (D-45) — the Stripe Customer Portal handles cards, cancellation, plan changes and invoices. Our entire job is generating a session and emailing the link.

---

## Affected apps / packages

| App / package    | Role                                                               |
| ---------------- | ------------------------------------------------------------------ |
| `packages/api`   | `stripe.createPortalSession` — creates a session, queues the email |
| `apps/native`    | **Manage Subscription** button → "check your inbox"                |
| `packages/email` | Portal link email (M8-T6 owns the template)                        |
| Stripe Dashboard | Portal configuration — see §3                                      |

---

## Scope

### 1 · Portal session by email

Same reasoning as activation (D-16): the app shows no external URL, so the portal link is emailed rather than opened.

- A **fresh session is created on every request.** Portal URLs are short-lived and single-use — never store one, never reuse one.
- Rate-limit on the existing Layer-2 Redis pattern, with its own bucket.
- No customer id on the profile → the venue never subscribed. Point them at activation (M8-T2), not the portal.

### 2 · No `/account` page

The previous version of this task specified a `ceolx.com/account` page in the admin app rendering subscription status, billing history and an invoice table. **All of that is Portal functionality.** Building it means maintaining a second billing UI that can disagree with Stripe, plus the venue-authentication problem the activation token exists to avoid.

The emailed link goes straight to the Portal. Nothing is built in `apps/admin` for this task.

### 3 · Portal configuration

Configured in the Stripe Dashboard, verified before launch, not code:

| Setting                                      | Value                                                                             |
| -------------------------------------------- | --------------------------------------------------------------------------------- |
| Payment method update                        | Enabled                                                                           |
| Invoice history                              | Enabled                                                                           |
| Cancellation                                 | Enabled, **at period end** (D-39)                                                 |
| Plan switching                               | Enabled between the monthly and annual prices                                     |
| `subscription_update.proration_behavior`     | Prorate — monthly→annual is immediate with credit (D-43)                          |
| `subscription_update.schedule_at_period_end` | Conditions set so a **downgrade** is scheduled to the end of the paid year (D-43) |
| Customer email update                        | Enabled (D-48)                                                                    |
| Cancellation reason                          | Enabled — free retention signal                                                   |

D-43 needs upgrades immediate and downgrades deferred. The Portal supports exactly this asymmetry natively through `schedule_at_period_end` conditions, so it is configuration and no custom flow is required. **Verify both directions against a test subscription before signing this off** — getting it wrong means either an unwanted refund obligation (immediate downgrade) or an angry venue (deferred upgrade).

### 4 · Reactivation

D-41: a venue that cancelled but is still inside its paid period reactivates in one click in the Portal. Billing resumes with no new sign-up and no new trial (D-42). No work here beyond making sure the Portal offers it and the resulting webhook is handled (M8-T3).

---

## Acceptance criteria

- [ ] **Manage Subscription** emails a working Portal link; the app shows no URL
- [ ] A new session is created per request; no portal URL is persisted anywhere
- [ ] Requests are rate-limited on a dedicated bucket
- [ ] A venue with no Stripe customer is routed to activation, not the portal
- [ ] Card update in the Portal takes effect with no change to access
- [ ] Cancellation schedules at period end; access continues until then; the webhook records it (M8-T3)
- [ ] Monthly→annual applies **immediately** with prorated credit
- [ ] Annual→monthly is **scheduled** to the end of the paid year; no refund is generated
- [ ] Reactivation inside the paid period restores billing with no new trial
- [ ] Invoices are downloadable from the Portal
- [ ] Nothing was built in `apps/admin` for this task
- [ ] Portal configuration recorded in the M12 pre-launch checklist

---

## Dependencies

- **Upstream**: M8-T1, M8-T3
- **Downstream**: M12 (pre-launch Portal verification)
- **External**: Stripe Customer Portal, Postmark

---

## Notes

Portal configuration is environment-specific — test-mode and live-mode configurations are separate objects. Configuring test and assuming live inherited it is the standard way this ships broken.
