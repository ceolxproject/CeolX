# Task 9: Subscription Upgrade/Downgrade Management

## Description

Implement subscription plan change functionality for users to upgrade from monthly to annual or downgrade from annual to monthly. Upgrades are processed immediately with prorated billing handled by Stripe, while downgrades take effect at the end of the current billing period. Both changes include confirmation emails and credit/charge adjustments.

## Affected Apps/Packages

- **Backend**: Hono API service (`packages/api`)
- **Database**: `subscriptions` table
- **Stripe Integration**: Stripe Subscription updates API

## API Endpoints

### POST /api/v1/subscriptions/upgrade

Upgrade subscription from monthly to annual plan.

**Request**:

```
POST /api/v1/subscriptions/upgrade
Headers:
  Content-Type: application/json
  Authorization: Bearer {user_jwt_token}

Body:
{
  "newPriceId": "price_1H5eSbI50VqksJqJ..." (annual price)
}
```

**Response (200 OK)**:

```json
{
  "success": true,
  "data": {
    "subscriptionId": "sub_1H5eSdI50VqksJqJ...",
    "fromPlan": {
      "id": "monthly",
      "name": "Premium Monthly",
      "price": 999
    },
    "toPlan": {
      "id": "annual",
      "name": "Premium Annual",
      "price": 9990
    },
    "effectiveDate": "2024-02-18T10:30:00Z",
    "billing": {
      "immediateCharge": 8091,
      "description": "Upgrade from monthly to annual (prorated, remaining balance from previous plan credited)",
      "chargeType": "upgrade_charge"
    },
    "confirmationDetails": {
      "message": "You've been upgraded to Annual plan! You'll be charged 80.91 EUR today.",
      "prorationInfo": "Your remaining monthly plan balance has been credited toward your annual subscription.",
      "nextBillingDate": "2025-02-18"
    }
  }
}
```

**Error Response (400 Bad Request - Invalid Price)**:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_PRICE",
    "message": "Invalid price ID or price does not exist"
  }
}
```

**Error Response (400 Already on Plan)**:

```json
{
  "success": false,
  "error": {
    "code": "ALREADY_ON_PLAN",
    "message": "User is already on the annual plan"
  }
}
```

**Error Response (400 No Subscription)**:

```json
{
  "success": false,
  "error": {
    "code": "NO_SUBSCRIPTION",
    "message": "User does not have an active subscription"
  }
}
```

### POST /api/v1/subscriptions/downgrade

Schedule downgrade from annual to monthly plan at period end.

**Request**:

```
POST /api/v1/subscriptions/downgrade
Headers:
  Content-Type: application/json
  Authorization: Bearer {user_jwt_token}

Body:
{
  "newPriceId": "price_1H5eSaI50VqksJqJ..." (monthly price)
}
```

**Response (200 OK)**:

```json
{
  "success": true,
  "data": {
    "subscriptionId": "sub_1H5eSdI50VqksJqJ...",
    "fromPlan": {
      "id": "annual",
      "name": "Premium Annual",
      "price": 9990
    },
    "toPlan": {
      "id": "monthly",
      "name": "Premium Monthly",
      "price": 999
    },
    "effectiveDate": "2025-02-18T10:30:00Z",
    "currentBillingPeriod": {
      "start": "2024-02-18",
      "end": "2025-02-18",
      "daysRemaining": 365
    },
    "billing": {
      "nextCharge": 999,
      "nextChargeDate": "2025-02-18",
      "description": "Monthly plan will start at end of annual billing period",
      "prorationInfo": "No credit due - you'll start paying monthly after your annual plan expires"
    },
    "confirmationDetails": {
      "message": "Downgrade scheduled! Your annual plan will continue until 2025-02-18, then switch to monthly at 9.99 EUR.",
      "actionRequired": false,
      "nextSteps": "Your monthly plan will begin automatically at the end of your annual billing period"
    }
  }
}
```

**Error Response (400 Bad Request)**:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_DOWNGRADE",
    "message": "Cannot downgrade: you are already on a monthly plan or plan is invalid"
  }
}
```

### GET /api/v1/subscriptions/changes/pending

Check if subscription changes are pending.

**Request**:

```
GET /api/v1/subscriptions/changes/pending
Headers:
  Authorization: Bearer {user_jwt_token}
```

**Response (200 OK - Pending Change)**:

```json
{
  "success": true,
  "data": {
    "hasPendingChange": true,
    "changeType": "downgrade",
    "fromPlan": {
      "id": "annual",
      "name": "Premium Annual"
    },
    "toPlan": {
      "id": "monthly",
      "name": "Premium Monthly"
    },
    "effectiveDate": "2025-02-18T10:30:00Z",
    "daysUntilChange": 365,
    "canCancel": true
  }
}
```

**Response (200 OK - No Pending Change)**:

```json
{
  "success": true,
  "data": {
    "hasPendingChange": false,
    "changeType": null,
    "effectiveDate": null
  }
}
```

### POST /api/v1/subscriptions/changes/cancel

Cancel a pending subscription downgrade.

**Request**:

```
POST /api/v1/subscriptions/changes/cancel
Headers:
  Content-Type: application/json
  Authorization: Bearer {user_jwt_token}
```

**Response (200 OK)**:

```json
{
  "success": true,
  "data": {
    "subscriptionId": "sub_1H5eSdI50VqksJqJ...",
    "message": "Pending downgrade canceled. You will remain on your Annual plan.",
    "currentPlan": {
      "id": "annual",
      "name": "Premium Annual"
    }
  }
}
```

## Requirements

### Upgrade Implementation (Monthly → Annual)

1. **Upgrade Logic**:
   - User is on monthly plan (price_monthly)
   - User requests upgrade to annual plan (price_annual)
   - Stripe calculates prorated refund of monthly plan
   - Charge is calculated: (annual_price - prorated_refund)
   - Update subscription immediately
   - Remaining balance from monthly plan credited toward annual

2. **Stripe Subscription Update**:

   ```typescript
   const subscription = await stripe.subscriptions.update(
     stripeSubscriptionId,
     {
       items: {
         0: {
           price: newPriceId,
           quantity: 1,
         },
       },
       proration_behavior: "create_prorations", // Create invoice for adjustment
       billing_cycle_anchor: "now", // Start new cycle immediately
     }
   );
   ```

3. **Prorated Billing**:
   - Stripe calculates: Days used on monthly plan / 30 = X days
   - Refund amount: X days worth of monthly subscription
   - New charge: Annual price - Refund amount (if positive)
   - If refund > annual price, credit applied to account

4. **Immediate Effect**:
   - Subscription plan changes immediately
   - New billing cycle starts immediately
   - Next billing date updates to one year from today
   - User has immediate access to all features (no change in access)

5. **Database Updates**:
   - Update subscription.plan_id to 'annual'
   - Update subscription.current_period_end (extend to 1 year)
   - Update subscription.updated_at

### Downgrade Implementation (Annual → Monthly)

1. **Downgrade Logic**:
   - User is on annual plan (price_annual)
   - User requests downgrade to monthly plan (price_monthly)
   - Downgrade scheduled for end of current annual period
   - No immediate charge (annual already paid)
   - At period end, Stripe automatically switches to monthly

2. **Stripe Subscription Update**:

   ```typescript
   const subscription = await stripe.subscriptions.update(
     stripeSubscriptionId,
     {
       items: {
         0: {
           price: newPriceId,
           quantity: 1,
         },
       },
       proration_behavior: "none", // No proration, change at period end
       billing_cycle_anchor: "unchanged", // Keep current billing cycle
     }
   );
   ```

3. **Delayed Effect**:
   - No immediate change to billing
   - User continues on annual plan until period end
   - At period end, Stripe automatically transitions to monthly
   - Next charge will be monthly amount

4. **User Communication**:
   - Confirm downgrade scheduled (not immediate)
   - Show current plan end date
   - Show when monthly charges will start
   - Offer option to cancel downgrade

5. **Database Updates**:
   - Create record of pending plan change (pending_change table)
   - Record scheduled_change_date = current_period_end
   - Update via webhook when `customer.subscription.updated` received

### Cancel Pending Downgrade

1. **Cancel Logic**:
   - Check if downgrade scheduled (via pending_change record)
   - If scheduled, revert subscription in Stripe
   - Update subscription back to annual price

2. **Stripe Revert**:

   ```typescript
   const subscription = await stripe.subscriptions.update(
     stripeSubscriptionId,
     {
       items: {
         0: {
           price: originalAnnualPriceId,
         },
       },
     }
   );
   ```

3. **Database Updates**:
   - Delete pending_change record
   - Update subscription.plan_id back to annual

### Database Schema

```sql
CREATE TABLE pending_subscription_changes (
  id UUID PRIMARY KEY,
  subscription_id UUID NOT NULL REFERENCES subscriptions(id),
  user_id UUID NOT NULL REFERENCES users(id),
  change_type VARCHAR(50) NOT NULL, -- 'upgrade', 'downgrade'
  from_plan_id VARCHAR(50) NOT NULL,
  to_plan_id VARCHAR(50) NOT NULL,
  from_price_id VARCHAR(255) NOT NULL,
  to_price_id VARCHAR(255) NOT NULL,
  scheduled_date TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  canceled_at TIMESTAMP
);

CREATE INDEX idx_pending_changes_user ON pending_subscription_changes(user_id);
CREATE INDEX idx_pending_changes_scheduled ON pending_subscription_changes(scheduled_date);
```

### Validation and Error Handling

1. **Upgrade Validation**:
   - User must have active subscription
   - Current plan must be monthly
   - New price must be annual plan price
   - Prevent upgrade if already annual

2. **Downgrade Validation**:
   - User must have active subscription
   - Current plan must be annual
   - New price must be monthly plan price
   - Prevent downgrade if already monthly

3. **Plan Change Validation**:
   - Prevent upgrading to same plan
   - Prevent downgrading to same plan
   - Validate price IDs exist in database/Stripe
   - Check user has no failed payments blocking changes

### Email Notifications

1. **Upgrade Confirmation Email**:
   - Subject: "Welcome to Premium Annual!"
   - Include: Plan change details, prorated charge, new billing date
   - Call to action: Link to manage subscription

2. **Downgrade Confirmation Email**:
   - Subject: "Downgrade scheduled to Monthly plan"
   - Include: Current plan continues until X, then switches to monthly
   - Show: Monthly charge amount and next charge date
   - Option to: Cancel downgrade via link/button

3. **Downgrade Completed Email** (via webhook):
   - Subject: "You're now on Premium Monthly"
   - Include: New monthly charge amount, next billing date

### User Experience Flow

**Upgrade (Monthly → Annual)**:

1. User visits Manage Subscription in portal or app
2. Options: See annual plan with savings
3. Click "Upgrade to Annual"
4. Confirm upgrade (show proration details)
5. Immediate charge (prorated)
6. Success message (annual plan active)
7. Confirmation email sent

**Downgrade (Annual → Monthly)**:

1. User visits Manage Subscription
2. Click "Downgrade to Monthly"
3. Warning: "Downgrade takes effect at end of current period"
4. Show current period end date
5. Show monthly charge amount
6. Confirm downgrade
7. Success message (downgrade scheduled)
8. Confirmation email sent with cancellation option

## Acceptance Criteria

- [ ] POST /api/v1/subscriptions/upgrade endpoint implemented
- [ ] Upgrade only allowed from monthly to annual plan
- [ ] Upgrade prevented if already on annual plan
- [ ] Upgrade requires active subscription
- [ ] Stripe subscription updated with new price
- [ ] Stripe proration_behavior set to 'create_prorations'
- [ ] Billing cycle anchor updated to 'now' for immediate effect
- [ ] Prorated charge calculated correctly
- [ ] Upgrade effect is immediate (user sees new plan immediately)
- [ ] Database updated with new plan ID and period end date
- [ ] POST /api/v1/subscriptions/downgrade endpoint implemented
- [ ] Downgrade only allowed from annual to monthly plan
- [ ] Downgrade prevented if already on monthly plan
- [ ] Downgrade scheduled for end of current period (not immediate)
- [ ] Stripe subscription updated with proration_behavior = 'none'
- [ ] Stripe billing cycle continues until period end
- [ ] No immediate charge for downgrade
- [ ] Pending change record created in database
- [ ] GET /api/v1/subscriptions/changes/pending returns correct status
- [ ] Pending change includes details and days until effective
- [ ] POST /api/v1/subscriptions/changes/cancel reverts pending downgrade
- [ ] Revert prevents automatic plan change at period end
- [ ] Upgrade confirmation email includes proration details
- [ ] Downgrade confirmation email includes effective date and cancellation option
- [ ] Error handling for invalid price IDs
- [ ] Error handling for attempted same-plan changes
- [ ] Error handling for subscription state issues
- [ ] JWT authentication required for all endpoints
- [ ] Users can only change their own subscriptions
- [ ] Database schema includes pending_subscription_changes table
- [ ] Webhook integration confirms plan changes (customer.subscription.updated)
- [ ] All Stripe API calls properly logged
- [ ] Unit tests cover upgrade/downgrade logic and validation
- [ ] Integration tests verify Stripe subscription updates
- [ ] API documentation includes endpoint specifications and examples

## Dependencies

- Task 1: Stripe Billing Setup (Stripe Products and Prices)
- Task 2: Subscription Plans API (subscription tracking)
- Task 6: Stripe Customer Portal (users may change plans here too)
- Task 8: Stripe Webhook Handlers (confirm plan changes via webhooks)
- Milestone 2: Database schema for subscriptions
- Milestone 4: User authentication (JWT validation)

## Technical Notes

### Proration Behavior Comparison

| Scenario                     | proration_behavior  | billing_cycle_anchor | Effect                               |
| ---------------------------- | ------------------- | -------------------- | ------------------------------------ |
| Upgrade (Monthly → Annual)   | `create_prorations` | `now`                | Immediate charge with refund applied |
| Downgrade (Annual → Monthly) | `none`              | `unchanged`          | No charge, change at period end      |
| Plan change, no effect       | `none`              | `unchanged`          | Change applied next billing cycle    |

### Proration Calculation Example

- Monthly plan: 9.99 EUR
- Annual plan: 99.90 EUR (11.10 EUR per month equivalent)
- User has used: 15 days of 30-day month
- Refund: (9.99 / 30) \* 15 = 4.995 EUR
- Immediate charge: 99.90 - 4.995 = 94.905 EUR (94.91 EUR rounded)

### Timezone Handling

- All dates in UTC
- Convert to user's timezone for display
- Billing dates stored in UTC
- Period end date is day of month/year, not affected by timezone

### Edge Cases to Handle

1. User on trial period attempting upgrade
   - Upgrade allowed
   - Remaining trial days may be credited

2. User with past due payment attempting change
   - Block change until payment resolved
   - Return 400 with clear error message

3. User on free trial attempting downgrade
   - During trial: Upgrade allowed (trial extended to annual)
   - After trial: Standard downgrade logic

4. Multiple pending changes
   - Only one pending change per subscription
   - New request cancels previous pending change

### Monitoring

1. Track upgrade/downgrade rates by plan
2. Monitor revenue impact of plan changes
3. Alert on failed subscription updates
4. Track customer satisfaction with plan changes

### Future Enhancements

1. **Pause Subscription**: Offer pause instead of downgrade
2. **Custom Billing Cycles**: Allow changes on any day (not just period end)
3. **Plan Comparison**: Show side-by-side comparison before change
4. **Save Features**: Offer discount to prevent downgrade
5. **Flexible Billing**: Support prepaid credits system
