# Task 12: Free Trial Implementation

## Status: Planned (not yet implemented)

## Context

DB schema already supports free trials via `subscriptionPlan.freeTrialDays` (integer, default 0) and `userSubscription.trialStart` / `trialEnd` timestamps. Stripe natively supports trial periods in subscription creation. This task wires the two together and adds UI messaging.

**Note:** Free trials are not mentioned in the PRD (v1.7). Confirm business requirement before implementing.

---

## Affected Files

| File                                                        | Change                                                                        |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `packages/api/src/routers/subscriptions.ts`                 | Pass `trial_period_days` to Stripe checkout when plan has `freeTrialDays > 0` |
| `packages/db/src/schema/payments.ts`                        | Already has `freeTrialDays` — no schema changes needed                        |
| `apps/web-learner/src/components/pricing/pricing-plans.tsx` | Show trial badge/messaging on plan cards                                      |
| `apps/web-learner/src/app/(app)/pricing/page.tsx`           | Pass `freeTrialDays` from API plan shape to UI                                |
| `packages/api/src/routers/subscriptions.ts`                 | Add `freeTrialDays` to `PlanShape` + `fetchPlansFromStripe()`                 |

---

## Implementation Plan

### Step 1: Expose `freeTrialDays` from API

In `packages/api/src/routers/subscriptions.ts`:

- Add `freeTrialDays: number` to `PlanShape` type
- Read from Stripe product metadata: `product.metadata.freeTrialDays` (parsed as integer, default 0)
- Include in all 4 plan objects returned by `fetchPlansFromStripe()`

### Step 2: Pass trial days to Stripe checkout

In `createCheckout` handler (`packages/api/src/routers/subscriptions.ts`):

- Look up the plan's `freeTrialDays` from the fetched plans cache or directly from Stripe product metadata
- If `freeTrialDays > 0`, add `subscription_data: { trial_period_days: freeTrialDays }` to `stripe.checkout.sessions.create()`
- Track trial dates: after successful checkout webhook fires, set `trialStart` and `trialEnd` on `userSubscription`

```ts
const session = await stripe.checkout.sessions.create({
  mode: "subscription",
  // ...existing fields
  subscription_data:
    freeTrialDays > 0 ? { trial_period_days: freeTrialDays } : undefined,
});
```

### Step 3: Webhook handling — store trial dates

In the Stripe webhook handler (`apps/server/src/routers/webhooks.ts` or similar):

- On `customer.subscription.created` event: read `trial_start` / `trial_end` from Stripe subscription object
- Store in `userSubscription.trialStart` and `userSubscription.trialEnd`

### Step 4: UI — trial badge on pricing cards

In `apps/web-learner/src/components/pricing/pricing-plans.tsx`:

- Add `freeTrialDays?: number` to `Plan` type
- In `PlanCard`, show a badge like "7-day free trial" below the price if `plan.freeTrialDays > 0`
- Update CTA button text: "Start free trial" instead of "Get started" when trial applies

### Step 5: Stripe product metadata

Set `freeTrialDays` on Stripe product metadata for any plan that should have a trial (e.g., `"freeTrialDays": "7"`). This drives the behavior without hardcoding.

---

## Edge Cases

- **Trial + coupon**: Stripe does not allow both `trial_period_days` and `discounts` in the same checkout session. If user enters a coupon and plan has a trial, prefer the coupon (better UX — user actively chose discount). Skip trial if coupon is provided.
- **Already trialed**: Track via `userSubscription.trialEnd` — if user has a past trial record, don't offer trial again (check before creating checkout).
- **Team plans**: Decide whether team plans get trials — likely yes, same mechanism.

---

## Verification

1. Set `freeTrialDays: "7"` on a Stripe product metadata
2. Restart API: `pnpm dev:api`
3. Hit `listPlans` — confirm `freeTrialDays: 7` in response
4. Start checkout for that plan — confirm Stripe checkout shows "7-day free trial" in Stripe UI
5. Confirm `userSubscription.trialStart` / `trialEnd` populated after webhook fires
6. Pricing page shows "7-day free trial" badge on relevant plan card

---

## Dependencies

- Task 2: Subscription Plans API (complete)
- Task 8: Stripe Webhook Handlers (must handle `customer.subscription.created`)
- Stripe product metadata: `freeTrialDays` key must be set per product
