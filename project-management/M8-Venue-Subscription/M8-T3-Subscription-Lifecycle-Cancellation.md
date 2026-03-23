# M8-T3 · Subscription Lifecycle & Cancellation Handling

| Field | Value |
|-------|-------|
| **Milestone** | M8 — Venue Subscription |
| **Status** | 🔲 To Do |
| **Depends on** | M8-T1 (Stripe subscription live) |
| **PRD Ref** | Section 9.8 (Venue Subscription Flow), Section 4.3 (Persona Switching — Subscription Persistence) |

---

## Description
Handle ongoing subscription lifecycle events from Stripe: payment failures, subscription cancellations, and renewals. Ensure `venue_profiles.subscription_status` always reflects the true billing state from Stripe.

---

## Affected Apps / Packages
| App / Package | Role |
|---------------|------|
| `apps/api` | Stripe webhook handler extension for lifecycle events |

---

## API Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/webhooks/stripe` | Extended to handle additional Stripe webhook event types |

---

## Requirements
- R1: Handle `customer.subscription.deleted` webhook → set `subscription_status = cancelled`
- R2: Handle `invoice.payment_failed` webhook → set `subscription_status = past_due`; send Postmark email to Venue notifying them of the failed payment
- R3: Handle `invoice.payment_succeeded` (renewal) → ensure `subscription_status = active` (in case it was `past_due`)
- R4: When `subscription_status = past_due` or `cancelled`: Venue profile becomes invisible (`is_active` reflects this); in-app shows the pending activation state (with appropriate message variant)
- R5: Switching AWAY from Venue persona does NOT cancel the subscription — billing continues; `is_active = false` but `subscription_status` unchanged
- R6: All webhook events validated with Stripe signature verification

---

## Acceptance Criteria
- [ ] Stripe `subscription.deleted` webhook sets `subscription_status = cancelled`
- [ ] Stripe `invoice.payment_failed` webhook sets `subscription_status = past_due` and sends Postmark email
- [ ] Stripe `invoice.payment_succeeded` sets `subscription_status = active` (resolves `past_due`)
- [ ] Venue with `past_due` or `cancelled` subscription sees profile hidden and in-app pending state
- [ ] Switching away from Venue persona while subscribed does not cancel the subscription
- [ ] All webhook events pass Stripe signature validation

---

## Technical Notes
- Stripe subscription statuses to map: `active` → `active`, `past_due` → `past_due`, `cancelled` / `unpaid` → `cancelled`
- `venue_profiles.subscription_status` enum should include: `inactive | active | past_due | cancelled`
- The `past_due` state is important: the Venue had a valid subscription but payment lapsed — different from `inactive` (never subscribed) and `cancelled` (explicitly cancelled)
- Cancellation is managed via the Stripe Customer Portal — CeolX does not build a cancellation UI in V1
