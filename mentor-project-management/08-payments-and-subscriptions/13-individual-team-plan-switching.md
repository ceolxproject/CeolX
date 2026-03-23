# Individual ↔ Team Plan Switching Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Individual ↔ Team plan switching to the billing page — Individual→Team via new Stripe Checkout, Team→Individual as a scheduled downgrade at period end.

**Architecture:** New `switchPlanType` API procedure handles both directions; new `PlanTypeSwitchSection` UI component mounts on billing page; webhook extended to auto-cancel old individual sub when team checkout completes; `PlanChangeSection` fixed to filter same-planType plans only.

**Tech Stack:** oRPC (protectedProcedure), Drizzle ORM, Stripe API, TanStack Query, shadcn AlertDialog, Sonner toasts.

---

## Context

The billing page has no way to switch between Individual and Team plan types. `PlanChangeSection` only handles Monthly↔Annual within the same planType. Team plans exist in Stripe but are inaccessible from billing. Additionally, `PlanChangeSection` has a latent bug where a Team Annual user could be shown "Switch to Individual Monthly" instead of "Switch to Team Monthly".

---

## Files To Modify/Create

| Action | File                                                                   | Purpose                                                           |
| ------ | ---------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Modify | `packages/validators/src/subscription.ts`                              | Add `switchPlanTypeSchema`                                        |
| Modify | `packages/api/src/routers/subscriptions.ts`                            | Add `switchPlanType` procedure + expose `planType` in `getStatus` |
| Modify | `apps/api/src/routes/webhooks/stripe.ts`                               | Auto-cancel old individual sub when team checkout succeeds        |
| Create | `apps/web-learner/src/components/billing/plan-type-switch-section.tsx` | New UI component                                                  |
| Modify | `apps/web-learner/src/components/billing/plan-change-section.tsx`      | Filter same-planType plans only                                   |
| Modify | `apps/web-learner/src/app/(app)/settings/billing/page.tsx`             | Mount new component + add `planType` to `Plan` type               |
| Modify | `packages/api/src/routers/__tests__/subscriptions.test.ts`             | Tests for `switchPlanType`                                        |
| Modify | `apps/api/src/routes/webhooks/__tests__/stripe.test.ts`                | Tests for auto-cancel webhook handler                             |

---

## Task 1: Add `switchPlanTypeSchema` validator

**Files:**

- Modify: `packages/validators/src/subscription.ts`

- [ ] Read `packages/validators/src/subscription.ts` to see existing exports
- [ ] Add `switchPlanTypeSchema`:

```ts
export const switchPlanTypeSchema = z.object({
  targetStripePriceId: z.string().min(1),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});
```

- [ ] Commit: `✨ feat(validators): add switchPlanTypeSchema`

---

## Task 2: Extend `getStatus` to expose `planType`

**Files:**

- Modify: `packages/api/src/routers/subscriptions.ts` (the block starting at the `// Override DB plan name/currency` comment, ~line 438)

The `getStatus` handler already reads cached Stripe plans to get name/price/currency. Extend it to also extract `planType`.

- [ ] In the existing override block, add:

```ts
const resolvedPlanType = matchedPlan?.planType ?? "single_user";
```

- [ ] Extend `resolvedPlan` object to include `planType`:

```ts
const resolvedPlan = plan
  ? {
      id: plan.id,
      name: stripePlanName ?? plan.name,
      interval: plan.interval,
      price: stripePlanPrice ?? plan.price,
      currency: stripePlanCurrency ?? plan.currency,
      planType: resolvedPlanType,
    }
  : derivedPlan
    ? { ...derivedPlan, planType: "single_user" as const }
    : null;
```

- [ ] Run `pnpm check-types` — verify no type errors
- [ ] Commit: `✨ feat(api-pkg): expose planType in subscription status response`

---

## Task 3: Add `switchPlanType` API procedure

**Files:**

- Modify: `packages/api/src/routers/subscriptions.ts`

Add `switchPlanTypeSchema` to existing imports from `@mentor/validators/subscription`. Add `cache.del` usage (already imported via `cache`).

- [ ] Write the failing test first (see Task 8) — then implement
- [ ] Add the procedure to `subscriptionsRouter`:

```ts
switchPlanType: protectedProcedure
  .input(switchPlanTypeSchema)
  .handler(async ({ input, context }) => {
    const userId = context.session.user.id;
    const statusCacheKey = `subscription:status:${userId}`;

    // Guard: validate price ID is a known configured price
    const knownPriceIds = [
      env.STRIPE_PRICE_PRO_MONTHLY,
      env.STRIPE_PRICE_PRO_ANNUAL,
      env.STRIPE_PRICE_TEAM_MONTHLY,
      env.STRIPE_PRICE_TEAM_ANNUAL,
    ].filter(Boolean);
    if (!knownPriceIds.includes(input.targetStripePriceId)) {
      throw new ORPCError("BAD_REQUEST", { message: "Invalid price ID" });
    }

    // Require active subscription
    const sub = await db.query.userSubscription.findFirst({
      where: and(
        eq(userSubscription.userId, userId),
        eq(userSubscription.status, "active")
      ),
    });
    if (!sub) {
      throw new ORPCError("BAD_REQUEST", { message: "No active subscription found" });
    }

    // Lookup both plans by their DB records
    const [currentPlan, targetPlan] = await Promise.all([
      db.query.subscriptionPlan.findFirst({
        where: eq(subscriptionPlan.id, sub.planId),
      }),
      db.query.subscriptionPlan.findFirst({
        where: eq(subscriptionPlan.stripePriceId, input.targetStripePriceId),
      }),
    ]);
    if (!currentPlan || !targetPlan) {
      throw new ORPCError("NOT_FOUND", { message: "Plan not found" });
    }
    if (currentPlan.id === targetPlan.id) {
      throw new ORPCError("BAD_REQUEST", { message: "Already on this plan" });
    }

    // Determine planType from cached Stripe plans
    const cachedPlans = await cache.get<PlansResult>(PLANS_CACHE_KEY);
    const currentPlanType =
      cachedPlans?.plans.find((p) => p.stripePriceId === currentPlan.stripePriceId)
        ?.planType ?? "single_user";
    const targetPlanShape = cachedPlans?.plans.find(
      (p) => p.stripePriceId === targetPlan.stripePriceId
    );
    const targetPlanType = targetPlanShape?.planType ?? "single_user";

    if (currentPlanType === targetPlanType) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Use the billing interval switcher for same plan type changes",
      });
    }

    // Branch A: Individual → Team — redirect to Stripe Checkout
    if (targetPlanType === "team") {
      if (!input.successUrl || !input.cancelUrl) {
        throw new ORPCError("BAD_REQUEST", {
          message: "successUrl and cancelUrl are required for team upgrade",
        });
      }
      const userRows = await db.select().from(user).where(eq(user.id, userId));
      const userRecord = userRows[0];
      let customerId = userRecord?.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: context.session.user.email,
          name: context.session.user.name,
          metadata: { userId },
        });
        customerId = customer.id;
        await db
          .update(user)
          .set({ stripeCustomerId: customerId })
          .where(eq(user.id, userId));
      }
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        line_items: [{ price: targetPlan.stripePriceId, quantity: 1 }],
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        client_reference_id: userId,
        metadata: {
          planId: targetPlanShape?.id ?? "team_monthly",
          userId,
          // Signal to webhook to auto-cancel the old individual sub
          cancelOldSubscriptionId: sub.stripeSubscriptionId,
        },
      });
      return {
        action: "checkout" as const,
        checkoutUrl: session.url,
        expiresAt: new Date((session.expires_at ?? 0) * 1000).toISOString(),
        scheduledDate: null as string | null,
        fromPlan: null as { id: string; name: string; interval: string } | null,
        toPlan: null as { id: string; name: string; interval: string } | null,
      };
    }

    // Branch B: Team → Individual — schedule downgrade at period end
    const existing = await db.query.pendingSubscriptionChange.findFirst({
      where: and(
        eq(pendingSubscriptionChange.userId, userId),
        isNull(pendingSubscriptionChange.canceledAt)
      ),
    });
    if (existing) {
      throw new ORPCError("BAD_REQUEST", {
        message: "A pending plan change already exists",
      });
    }

    const stripeSub = await stripe.subscriptions.retrieve(
      sub.stripeSubscriptionId
    );
    const itemId = stripeSub.items.data[0]?.id;
    if (!itemId) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "No subscription item found",
      });
    }

    await stripe.subscriptions.update(sub.stripeSubscriptionId, {
      items: [{ id: itemId, price: targetPlan.stripePriceId }],
      proration_behavior: "none",
      billing_cycle_anchor: "unchanged",
    });

    const scheduledDate = sub.currentPeriodEnd;
    await db.insert(pendingSubscriptionChange).values({
      subscriptionId: sub.id,
      userId,
      changeType: "downgrade",
      fromPlanId: currentPlan.id,
      toPlanId: targetPlan.id,
      fromStripePriceId: currentPlan.stripePriceId,
      toStripePriceId: targetPlan.stripePriceId,
      scheduledDate,
    });

    await cache.del(statusCacheKey);

    return {
      action: "scheduled" as const,
      checkoutUrl: null as string | null,
      expiresAt: null as string | null,
      scheduledDate: scheduledDate.toISOString(),
      fromPlan: {
        id: currentPlan.id,
        name: currentPlan.name,
        interval: currentPlan.interval,
      },
      toPlan: {
        id: targetPlan.id,
        name: targetPlan.name,
        interval: targetPlan.interval,
      },
    };
  }),
```

- [ ] Run `pnpm check-types` — fix any type errors
- [ ] Commit: `✨ feat(api-pkg): add switchPlanType procedure`

---

## Task 4: Extend webhook to auto-cancel old sub on team upgrade

**Files:**

- Modify: `apps/api/src/routes/webhooks/stripe.ts`

The `handleCheckoutSessionCompleted` currently only processes course purchases (early-returns when `courseId` is absent). We need a second handler for subscription checkouts that carries `cancelOldSubscriptionId` in metadata.

- [ ] Add new function after `handleCheckoutSessionCompleted`:

```ts
async function handleSubscriptionCheckoutCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  const cancelOldSubscriptionId = session.metadata?.cancelOldSubscriptionId;
  if (!cancelOldSubscriptionId) return;

  // Schedule the old individual subscription to cancel at period end
  await stripe.subscriptions.update(cancelOldSubscriptionId, {
    cancel_at_period_end: true,
  });

  // Mark it in DB too so UI reflects the cancellation
  await db
    .update(userSubscription)
    .set({ cancelAtPeriodEnd: true })
    .where(eq(userSubscription.stripeSubscriptionId, cancelOldSubscriptionId));
}
```

- [ ] In the `checkout.session.completed` switch case, call both handlers:

```ts
case "checkout.session.completed": {
  const session = event.data.object as Stripe.Checkout.Session;
  await handleCheckoutSessionCompleted(session);
  await handleSubscriptionCheckoutCompleted(session);
  break;
}
```

- [ ] Run `pnpm check-types` — fix any type errors
- [ ] Commit: `✨ feat(api): auto-cancel old individual sub on team checkout success`

---

## Task 5: Fix `PlanChangeSection` to filter same-planType plans

**Files:**

- Modify: `apps/web-learner/src/components/billing/plan-change-section.tsx`

Currently `annualPlan`/`monthlyPlan` are looked up without a `planType` guard, so a Team Annual user would see "Switch to Individual Monthly" instead of "Switch to Team Monthly".

- [ ] Update the `Plan` type in this component to include `planType`:

```ts
type Plan = {
  id: string;
  name: string;
  interval: string;
  price: number;
  currency: string;
  planType?: "single_user" | "team";
};
```

- [ ] Fix the plan lookup to match same planType (default to `"single_user"` if prop missing):

```ts
const currentPlanType = plan.planType ?? "single_user";

const annualPlan = plans.find(
  (p) => p.billingPeriod === "annual" && p.planType === currentPlanType
);
const monthlyPlan = plans.find(
  (p) => p.billingPeriod === "monthly" && p.planType === currentPlanType
);
```

- [ ] Run `pnpm check-types` — fix any type errors
- [ ] Commit: `🐛 fix(web-learner): filter same-planType in PlanChangeSection interval switcher`

---

## Task 6: Create `PlanTypeSwitchSection` component

**Files:**

- Create: `apps/web-learner/src/components/billing/plan-type-switch-section.tsx`

Reuses the `queryKey: ["subscriptions", "plans"]` already used by `PlanChangeSection` — zero extra network requests due to TanStack Query deduplication.

- [ ] Create the component:

```tsx
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserIcon, UsersIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@mentor/ui/components/alert-dialog";
import { Button } from "@mentor/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@mentor/ui/components/card";
import { Spinner } from "@mentor/ui/components/spinner";

import { client } from "@/utils/orpc";

type Plan = {
  id: string;
  name: string;
  interval: string;
  price: number;
  currency: string;
  planType: "single_user" | "team";
};

type Subscription = {
  status: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
};

type PlanTypeSwitchSectionProps = {
  plan: Plan;
  subscription: Subscription;
  onSwitched: () => void;
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

export const PlanTypeSwitchSection = ({
  plan,
  subscription,
  onSwitched,
}: PlanTypeSwitchSectionProps) => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: plansData } = useQuery({
    queryKey: ["subscriptions", "plans"],
    queryFn: () => client.subscriptions.listPlans(),
  });

  const { mutate: switchPlanType, isPending } = useMutation({
    mutationFn: (vars: {
      targetStripePriceId: string;
      successUrl?: string;
      cancelUrl?: string;
    }) => client.subscriptions.switchPlanType(vars),
    onSuccess: (result) => {
      if (result.action === "checkout" && result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
        return;
      }
      if (result.action === "scheduled" && result.toPlan) {
        toast.success(
          `Switch to ${result.toPlan.name} scheduled for ${formatDate(result.scheduledDate!)}.`
        );
        setDialogOpen(false);
        void queryClient.invalidateQueries({
          queryKey: ["subscriptions", "status"],
        });
        void queryClient.invalidateQueries({
          queryKey: ["subscriptions", "pendingChange"],
        });
        onSwitched();
      }
    },
    onError: () => {
      toast.error("Failed to switch plan type. Please try again.");
    },
  });

  // Don't show if not active or already canceling
  if (subscription.status !== "active" || subscription.cancelAtPeriodEnd) {
    return null;
  }

  const plans = plansData?.plans ?? [];
  const teamPlans = plans.filter((p) => p.planType === "team");

  // Hide section entirely when no team plans are configured
  if (teamPlans.length === 0) return null;

  const isTeam = plan.planType === "team";

  if (isTeam) {
    // Team → Individual: find same-interval individual plan
    const targetPlan = plans.find(
      (p) => p.planType === "single_user" && p.billingPeriod === plan.interval
    );
    if (!targetPlan) return null;

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            Switch to Individual
          </CardTitle>
          <CardDescription>
            Downgrade to an individual plan — takes effect at your next renewal
            on {formatDate(subscription.currentPeriodEnd)}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <AlertDialogTrigger
              render={
                <Button size="sm" variant="outline">
                  <UserIcon className="mr-2 size-4" />
                  Switch to Individual
                </Button>
              }
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Switch to Individual Plan?</AlertDialogTitle>
                <AlertDialogDescription>
                  Your plan will switch to <strong>{targetPlan.name}</strong> (
                  {targetPlan.price.formattedAmount}/
                  {plan.interval === "monthly" ? "month" : "year"}) on{" "}
                  {formatDate(subscription.currentPeriodEnd)}. Team features and
                  seat management will be removed at that time.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() =>
                    switchPlanType({
                      targetStripePriceId: targetPlan.stripePriceId,
                    })
                  }
                  disabled={isPending}
                >
                  {isPending && <Spinner className="mr-2 size-4" />}
                  Confirm Switch
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    );
  }

  // Individual → Team: prefer same-interval team plan, fallback to first
  const targetPlan =
    teamPlans.find((p) => p.billingPeriod === plan.interval) ?? teamPlans[0];
  if (!targetPlan) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">
          Upgrade to Team
        </CardTitle>
        <CardDescription>
          Unlock team dashboard, seat management, and progress tracking
          {targetPlan.maxTeamMembers
            ? ` for up to ${targetPlan.maxTeamMembers} members`
            : ""}
          .
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <AlertDialogTrigger
            render={
              <Button size="sm" variant="default">
                <UsersIcon className="mr-2 size-4" />
                Upgrade to Team — {targetPlan.price.formattedAmount}/
                {targetPlan.billingPeriod === "monthly" ? "month" : "year"}
              </Button>
            }
          />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Upgrade to Team Plan?</AlertDialogTitle>
              <AlertDialogDescription>
                You&apos;ll be taken to checkout to start the{" "}
                <strong>{targetPlan.name}</strong> plan (
                {targetPlan.price.formattedAmount}/
                {targetPlan.billingPeriod === "monthly" ? "month" : "year"}).
                Your current individual plan will automatically cancel at its
                next renewal date.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  const origin = window.location.origin;
                  switchPlanType({
                    targetStripePriceId: targetPlan.stripePriceId,
                    successUrl: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
                    cancelUrl: `${origin}/settings/billing`,
                  });
                }}
                disabled={isPending}
              >
                {isPending && <Spinner className="mr-2 size-4" />}
                Go to Checkout
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
};
```

- [ ] Run `pnpm check-types` — fix any type errors
- [ ] Commit: `✨ feat(web-learner): add PlanTypeSwitchSection component`

---

## Task 7: Update billing page

**Files:**

- Modify: `apps/web-learner/src/app/(app)/settings/billing/page.tsx`

- [ ] Add `planType` to the local `Plan` type:

```ts
type Plan = {
  id: string;
  name: string;
  interval: string;
  price: number;
  currency: string;
  planType?: "single_user" | "team";
};
```

- [ ] Import `PlanTypeSwitchSection`:

```ts
import { PlanTypeSwitchSection } from "@/components/billing/plan-type-switch-section";
```

- [ ] Mount it between `SubscriptionStatusCard` and `PlanChangeSection`:

```tsx
{
  data.subscription && data.plan && (
    <PlanTypeSwitchSection
      plan={{
        ...data.plan,
        planType: data.plan.planType ?? "single_user",
      }}
      subscription={data.subscription}
      onSwitched={handleRefetch}
    />
  );
}
```

- [ ] Run `pnpm check-types` — fix any type errors
- [ ] Commit: `✨ feat(web-learner): mount PlanTypeSwitchSection on billing page`

---

## Task 8: Tests — `switchPlanType` procedure

**Files:**

- Modify: `packages/api/src/routers/__tests__/subscriptions.test.ts`

- [ ] Read the test file to understand existing mock structure (cache mock, DB mock, Stripe mock)
- [ ] Add `cache.del` to the cache mock:

```ts
const mockCacheDel = vi.fn();
vi.mock("@mentor/cache", () => ({
  cache: {
    get: (...args: unknown[]) => mockCacheGet(...args),
    set: (...args: unknown[]) => mockCacheSet(...args),
    del: (...args: unknown[]) => mockCacheDel(...args),
  },
}));
// in beforeEach: mockCacheDel.mockResolvedValue(undefined)
```

- [ ] Add `switchPlanTypeSchema` to validator mock
- [ ] Add team plan fixtures:

```ts
const teamMonthlyPlan = {
  id: "plan-team-monthly-uuid",
  name: "Team Monthly",
  interval: "monthly",
  price: "49.99",
  currency: "EUR",
  stripePriceId: "price_team_monthly",
};
```

- [ ] Add `describe("switchPlanType")` block with these test cases:
  1. **Throws BAD_REQUEST** when `targetStripePriceId` not in known price IDs
  2. **Throws BAD_REQUEST** when no active subscription
  3. **Throws NOT_FOUND** when target plan not in DB
  4. **Throws BAD_REQUEST** when same planType (e.g. individual monthly → individual annual)
  5. **Individual → Team**: returns `{ action: "checkout", checkoutUrl }` and calls `stripe.checkout.sessions.create`
  6. **Individual → Team**: throws BAD_REQUEST when `successUrl`/`cancelUrl` missing
  7. **Team → Individual**: returns `{ action: "scheduled", scheduledDate }`, calls `stripe.subscriptions.update` with `proration_behavior: "none"`, inserts `pendingSubscriptionChange`, calls `cache.del`
  8. **Team → Individual**: throws BAD_REQUEST when pending change already exists

- [ ] Run tests: `pnpm -F @mentor/api test -- --run subscriptions`
- [ ] Fix until all pass
- [ ] Commit: `✅ test(api-pkg): add switchPlanType procedure tests`

---

## Task 9: Tests — webhook auto-cancel handler

**Files:**

- Modify: `apps/api/src/routes/webhooks/__tests__/stripe.test.ts`

- [ ] Read existing test file to understand mock setup
- [ ] Add test for `checkout.session.completed` with `cancelOldSubscriptionId` in metadata:
  - When `cancelOldSubscriptionId` present: verify `stripe.subscriptions.update` called with `{ cancel_at_period_end: true }` and DB `userSubscription` updated with `cancelAtPeriodEnd: true`
  - When `cancelOldSubscriptionId` absent: verify no extra Stripe call made
- [ ] Run tests: `pnpm -F api test -- --run stripe`
- [ ] Fix until all pass
- [ ] Commit: `✅ test(api): add auto-cancel old sub webhook tests`

---

## Verification

1. **Type check all packages:** `pnpm check-types`
2. **Run all tests:** `pnpm test`
3. **Manual — Individual → Team:**
   - Go to `/settings/billing` on an active individual plan
   - See "Upgrade to Team" card (only if `STRIPE_PRICE_TEAM_MONTHLY/ANNUAL` set)
   - Click "Go to Checkout" → redirected to Stripe Checkout
   - Complete test checkout → redirected to `/checkout/success`
   - Old individual sub should be set to `cancel_at_period_end: true` in Stripe
4. **Manual — Team → Individual:**
   - On a team plan billing page, see "Switch to Individual" card
   - Click "Confirm Switch" → toast confirms scheduled date
   - Billing page shows pending downgrade (reuses existing `PlanChangeSection` pending state display)
5. **Manual — Team interval switch:**
   - On Team Annual plan, "Change Plan" section should show "Switch to Team Monthly" (not individual monthly)
6. **Hide when no team plans:** Remove `STRIPE_PRICE_TEAM_*` env vars → "Upgrade to Team" section disappears
