# Task 10: Subscriptions and Payments Tables

## Description

Create tables for managing subscription plans, user subscriptions, payment processing, and promotional coupons. Integrates with Stripe for payment processing and supports multiple subscription tiers (monthly, annual) with free trial periods and coupon-based discounts.

## Affected Apps/Packages

- `packages/db` (schema definition)
- `apps/api` (subscription and payment endpoints)
- `apps/web-learner` (subscription purchase flow)
- `apps/web-admin` (subscription and payment management)

## Requirements

### Subscription Plans Table

Create table `subscription_plans` for available subscription tiers:

| Column               | Type            | Constraints                | Description                                        |
| -------------------- | --------------- | -------------------------- | -------------------------------------------------- |
| `id`                 | `UUID`          | PK, Default: `uuid_v7()`   | Unique plan identifier                             |
| `name`               | `VARCHAR(100)`  | UNIQUE, NOT NULL           | Plan name (e.g., "Pro", "Premium")                 |
| `description`        | `TEXT`          | NULL                       | Plan description for marketing                     |
| `price`              | `DECIMAL(10,2)` | NOT NULL                   | Price amount                                       |
| `currency`           | `VARCHAR(3)`    | NOT NULL, DEFAULT: 'USD'   | ISO 4217 currency code                             |
| `interval`           | `VARCHAR(50)`   | NOT NULL                   | Enum: monthly, annual                              |
| `interval_count`     | `INTEGER`       | DEFAULT: 1                 | Number of interval units (1 month, 3 months, etc.) |
| `stripe_price_id`    | `VARCHAR(255)`  | UNIQUE, NOT NULL           | Stripe Price API ID                                |
| `stripe_product_id`  | `VARCHAR(255)`  | NOT NULL                   | Stripe Product API ID                              |
| `free_trial_days`    | `INTEGER`       | DEFAULT: 0                 | Number of free trial days                          |
| `max_active_courses` | `INTEGER`       | DEFAULT: -1                | Max courses (-1 = unlimited)                       |
| `max_team_members`   | `INTEGER`       | DEFAULT: 0                 | Max team members (0 = not allowed)                 |
| `features`           | `JSONB`         | DEFAULT: '{}'              | Plan features (JSON object)                        |
| `is_active`          | `BOOLEAN`       | DEFAULT: TRUE              | Whether plan is available for purchase             |
| `sort_order`         | `INTEGER`       | DEFAULT: 0                 | Display order on pricing page                      |
| `created_at`         | `TIMESTAMP`     | NOT NULL, DEFAULT: `now()` | Plan creation timestamp                            |
| `updated_at`         | `TIMESTAMP`     | NOT NULL, DEFAULT: `now()` | Last update timestamp                              |

### Plan Features JSON Structure

Example features object:

```json
{
  "unlimited_access": true,
  "priority_support": true,
  "analytics": true,
  "certificates": true,
  "api_access": false,
  "custom_domain": false
}
```

### Indexes for Subscription Plans Table

- Primary Key: `id`
- Unique Index: `(name)` - prevent duplicate plans
- Unique Index: `(stripe_price_id)` - Stripe integration uniqueness
- Index: `(is_active)` - find active plans
- Index: `(interval)` - filter by billing period

### User Subscriptions Table

Create table `user_subscriptions`:

| Column                   | Type            | Constraints                           | Description                                       |
| ------------------------ | --------------- | ------------------------------------- | ------------------------------------------------- |
| `id`                     | `UUID`          | PK, Default: `uuid_v7()`              | Unique subscription identifier                    |
| `user_id`                | `UUID`          | FK → users(id), NOT NULL              | Subscriber                                        |
| `plan_id`                | `UUID`          | FK → subscription_plans(id), NOT NULL | Subscribed plan                                   |
| `stripe_subscription_id` | `VARCHAR(255)`  | UNIQUE, NOT NULL                      | Stripe Subscription ID                            |
| `stripe_customer_id`     | `VARCHAR(255)`  | NOT NULL                              | Stripe Customer ID                                |
| `status`                 | `VARCHAR(50)`   | NOT NULL                              | Enum: active, past_due, canceled, paused, pending |
| `current_period_start`   | `TIMESTAMP`     | NOT NULL                              | Current billing period start                      |
| `current_period_end`     | `TIMESTAMP`     | NOT NULL                              | Current billing period end                        |
| `cancel_at_period_end`   | `BOOLEAN`       | DEFAULT: FALSE                        | Cancel after current period                       |
| `canceled_at`            | `TIMESTAMP`     | NULL                                  | When subscription was canceled                    |
| `trial_start`            | `TIMESTAMP`     | NULL                                  | When trial started                                |
| `trial_end`              | `TIMESTAMP`     | NULL                                  | When trial ends                                   |
| `pause_at`               | `TIMESTAMP`     | NULL                                  | When subscription was paused                      |
| `pause_until`            | `TIMESTAMP`     | NULL                                  | Until when subscription is paused                 |
| `coupon_code`            | `VARCHAR(50)`   | NULL                                  | Applied coupon code                               |
| `discount_percentage`    | `DECIMAL(5,2)`  | DEFAULT: 0                            | Discount from coupon (0-100%)                     |
| `discount_amount`        | `DECIMAL(10,2)` | DEFAULT: 0                            | Discount amount in currency                       |
| `created_at`             | `TIMESTAMP`     | NOT NULL, DEFAULT: `now()`            | Subscription creation                             |
| `updated_at`             | `TIMESTAMP`     | NOT NULL, DEFAULT: `now()`            | Last update                                       |

### Unique Constraint for User Subscriptions

- Composite unique index: `(user_id)` where `status NOT IN ('canceled')` - one active subscription per user

### Indexes for User Subscriptions Table

- Primary Key: `id`
- Index: `(user_id)` - find user's subscriptions
- Index: `(plan_id)` - find subscribers of plan
- Index: `(status)` - filter by status
- Index: `(stripe_subscription_id)` - Stripe sync
- Index: `(stripe_customer_id)` - customer lookup
- Index: `(current_period_end)` - expiring subscriptions
- Index: `(status, current_period_end)` - find expiring active subscriptions

### Payments Table

Create table `payments`:

| Column                     | Type            | Constraints                       | Description                                   |
| -------------------------- | --------------- | --------------------------------- | --------------------------------------------- |
| `id`                       | `UUID`          | PK, Default: `uuid_v7()`          | Unique payment identifier                     |
| `user_id`                  | `UUID`          | FK → users(id), NOT NULL          | Payer                                         |
| `stripe_payment_intent_id` | `VARCHAR(255)`  | UNIQUE, NOT NULL                  | Stripe PaymentIntent ID                       |
| `stripe_charge_id`         | `VARCHAR(255)`  | NULL                              | Stripe Charge ID (after success)              |
| `subscription_id`          | `UUID`          | FK → user_subscriptions(id), NULL | Related subscription                          |
| `course_id`                | `UUID`          | FK → courses(id), NULL            | Purchased course (if applicable)              |
| `amount`                   | `DECIMAL(10,2)` | NOT NULL                          | Amount charged                                |
| `currency`                 | `VARCHAR(3)`    | NOT NULL, DEFAULT: 'USD'          | Currency code                                 |
| `type`                     | `VARCHAR(50)`   | NOT NULL                          | Enum: subscription, one_time, course_purchase |
| `status`                   | `VARCHAR(50)`   | NOT NULL                          | Enum: pending, succeeded, failed, canceled    |
| `receipt_url`              | `TEXT`          | NULL                              | Stripe receipt URL                            |
| `failure_message`          | `TEXT`          | NULL                              | If failed, error message                      |
| `billing_email`            | `VARCHAR(255)`  | NOT NULL                          | Email for receipt                             |
| `billing_name`             | `VARCHAR(255)`  | NOT NULL                          | Name for receipt                              |
| `created_at`               | `TIMESTAMP`     | NOT NULL, DEFAULT: `now()`        | Payment creation                              |
| `updated_at`               | `TIMESTAMP`     | NOT NULL, DEFAULT: `now()`        | Last update                                   |

### Indexes for Payments Table

- Primary Key: `id`
- Index: `(user_id)` - find user's payments
- Index: `(stripe_payment_intent_id)` - Stripe sync
- Index: `(status)` - filter by status
- Index: `(type)` - payment type analytics
- Index: `(created_at)` - recent payments
- Index: `(course_id)` - course purchase analytics

### Coupons Table

Create table `coupons`:

| Column                  | Type            | Constraints                | Description                             |
| ----------------------- | --------------- | -------------------------- | --------------------------------------- |
| `id`                    | `UUID`          | PK, Default: `uuid_v7()`   | Unique coupon identifier                |
| `code`                  | `VARCHAR(50)`   | UNIQUE, NOT NULL           | Coupon code (e.g., "SAVE20")            |
| `description`           | `TEXT`          | NULL                       | Coupon description                      |
| `discount_type`         | `VARCHAR(50)`   | NOT NULL                   | Enum: percentage, fixed_amount          |
| `discount_value`        | `DECIMAL(10,2)` | NOT NULL                   | Discount percentage (0-100) or amount   |
| `currency`              | `VARCHAR(3)`    | DEFAULT: 'USD'             | Currency for fixed amount               |
| `max_discount_amount`   | `DECIMAL(10,2)` | NULL                       | Cap on discount (useful for percentage) |
| `min_purchase_amount`   | `DECIMAL(10,2)` | NULL                       | Minimum purchase to apply coupon        |
| `max_usage_count`       | `INTEGER`       | NULL                       | Total usage limit                       |
| `usage_count`           | `INTEGER`       | DEFAULT: 0                 | Current usage count                     |
| `per_user_limit`        | `INTEGER`       | DEFAULT: 1                 | How many times one user can use         |
| `applicable_plan_ids`   | `UUID[]`        | NULL                       | Limit to specific plans (NULL = all)    |
| `applicable_course_ids` | `UUID[]`        | NULL                       | Limit to specific courses (NULL = all)  |
| `user_segment`          | `VARCHAR(50)`   | NULL                       | Enum: all, new_users, specific_emails   |
| `segment_data`          | `JSONB`         | NULL                       | Email list or other segment criteria    |
| `valid_from`            | `TIMESTAMP`     | NULL                       | Coupon validity start                   |
| `valid_until`           | `TIMESTAMP`     | NOT NULL                   | Coupon expiration                       |
| `is_active`             | `BOOLEAN`       | DEFAULT: TRUE              | Whether coupon can be used              |
| `created_at`            | `TIMESTAMP`     | NOT NULL, DEFAULT: `now()` | Creation timestamp                      |
| `updated_at`            | `TIMESTAMP`     | NOT NULL, DEFAULT: `now()` | Last update                             |

### Indexes for Coupons Table

- Primary Key: `id`
- Unique Index: `(code)` - prevent duplicate codes
- Index: `(valid_until)` - find active coupons
- Index: `(is_active)` - filter active coupons
- Partial Index: `(code)` WHERE `is_active = true AND valid_until > NOW()` - active coupon lookup

### All-Access Courses Junction Table

Create table `subscription_all_access_courses`:

| Column       | Type      | Constraints                           | Description              |
| ------------ | --------- | ------------------------------------- | ------------------------ |
| `id`         | `UUID`    | PK, Default: `uuid_v7()`              | Unique record identifier |
| `plan_id`    | `UUID`    | FK → subscription_plans(id), NOT NULL | Plan including courses   |
| `course_id`  | `UUID`    | FK → courses(id), NOT NULL            | Course included          |
| `sort_order` | `INTEGER` | DEFAULT: 0                            | Display order            |

### Unique Constraint for All-Access Courses

- Composite unique index: `(plan_id, course_id)` - prevent duplicates

### Indexes for All-Access Courses

- Primary Key: `id`
- Index: `(plan_id)` - find courses in plan
- Index: `(course_id)` - find plans including course

### Enums Definition

Create PostgreSQL ENUM types:

```sql
CREATE TYPE subscription_interval AS ENUM ('monthly', 'annual');
CREATE TYPE subscription_status AS ENUM ('active', 'past_due', 'canceled', 'paused', 'pending');
CREATE TYPE payment_type AS ENUM ('subscription', 'one_time', 'course_purchase');
CREATE TYPE payment_status AS ENUM ('pending', 'succeeded', 'failed', 'canceled');
CREATE TYPE coupon_discount_type AS ENUM ('percentage', 'fixed_amount');
CREATE TYPE user_segment AS ENUM ('all', 'new_users', 'specific_emails');
```

### Drizzle Schema Definition

In `packages/db/src/schema/subscriptions.ts`:

- Define `subscriptionPlans` table
- Define `userSubscriptions` table
- Define `payments` table
- Define `coupons` table
- Define `subscriptionAllAccessCourses` junction table
- Use `relations()` for:
  - subscriptionPlans ↔ userSubscriptions (one-to-many)
  - subscriptionPlans ↔ subscriptionAllAccessCourses (one-to-many)
  - courses ↔ subscriptionAllAccessCourses (one-to-many)
  - users ↔ userSubscriptions (one-to-many)
  - users ↔ payments (one-to-many)

## Database Tables

### subscription_plans

- **Purpose**: Define available subscription options
- **Row estimate**: ~5-20 plans (rarely changes)
- **Key relationships**: 1:N with user_subscriptions, N:N with courses

### user_subscriptions

- **Purpose**: Track active and past subscriptions
- **Row estimate**: ~100K-1M subscriptions
- **Key relationships**: N:1 with users, N:1 with plans

### payments

- **Purpose**: Payment history and transaction tracking
- **Row estimate**: ~500K-5M payments (all transactions)
- **Key relationships**: N:1 with users, N:1 with subscriptions/courses

### coupons

- **Purpose**: Promotional discount codes
- **Row estimate**: ~100-1000 coupons
- **Key relationships**: N:N with plans (via applicable_plan_ids ARRAY)

### subscription_all_access_courses

- **Purpose**: Map included courses to plans
- **Row estimate**: ~100-500 inclusions
- **Key relationships**: N:1 with plans, N:1 with courses

## Acceptance Criteria

- [ ] `subscription_plans` table created with Stripe integration fields
- [ ] `user_subscriptions` table tracks active subscriptions
- [ ] `payments` table records all transactions (subscriptions, one-time, purchases)
- [ ] `coupons` table supports percentage and fixed amount discounts
- [ ] Unique constraint on (user_id) for one active subscription per user
- [ ] Subscription status enum enforces valid statuses
- [ ] Payment status tracks pending → succeeded → failed states
- [ ] `stripe_subscription_id` and `stripe_payment_intent_id` enable Stripe sync
- [ ] Coupon can be limited to specific plans/courses
- [ ] Coupon usage tracking (max usage, per-user limit)
- [ ] Coupon can be limited to user segments (new users, email list)
- [ ] `subscription_all_access_courses` supports plan bundles
- [ ] Free trial period tracked separately
- [ ] All timestamps use UTC timezone
- [ ] Test data with multiple subscription plans and payments
- [ ] Test coupon application and limits
- [ ] Migration file generated and runnable

## Dependencies

- Task 01: Drizzle ORM Setup and Configuration
- Task 02: Users and Profiles Tables
- Task 06: Courses, Modules, and Lessons Tables
- Task 09: Enrollments and Progress Tables
- Stripe account with API credentials

## Technical Notes

### Stripe Integration

- `stripe_product_id` and `stripe_price_id` link to Stripe
- `stripe_subscription_id` for Stripe Subscription API calls
- `stripe_payment_intent_id` for Stripe payment tracking
- `stripe_customer_id` for Stripe customer management
- Webhook from Stripe updates subscription status
- Store Stripe API keys securely (environment variables)

### Subscription Status Lifecycle

- **pending** - Subscription created, initial payment pending
- **active** - Subscription active, within billing period
- **past_due** - Payment failed, awaiting retry
- **canceled** - User or system canceled
- **paused** - Temporarily paused (can be resumed)

### Free Trial Implementation

- `trial_start` and `trial_end` track trial period
- Zero charge during trial
- First payment on trial_end date
- If payment fails on trial_end, set status to past_due
- Grace period: 3 days to fix payment before cancellation

### Coupon Discounts

- **percentage**: Discount as percentage (e.g., 20 = 20% off)
- **fixed_amount**: Fixed discount amount (e.g., $10 off)
- `max_discount_amount` caps percentage discount
- Example: 50% off with max $25 discount

### Coupon Segments

- **all** - Available to everyone
- **new_users** - Only users who created account < 7 days ago
- **specific_emails** - Only emails in segment_data JSONB

### Segment Data Structure

```json
{
  "emails": ["user1@example.com", "user2@example.com"]
}
```

### Coupon Validation

```typescript
const validateCoupon = async (coupon, user, planId) => {
  // Check if coupon exists and is active
  if (!coupon.isActive || coupon.validUntil < NOW) {
    return { valid: false, reason: "Coupon expired" };
  }

  // Check usage limits
  if (coupon.maxUsageCount && coupon.usageCount >= coupon.maxUsageCount) {
    return { valid: false, reason: "Coupon usage limit reached" };
  }

  // Check per-user limit
  const userUsageCount = await db
    .select()
    .from(payments)
    .where(
      and(eq(payments.userId, user.id), eq(payments.couponCode, coupon.code)),
    );
  if (coupon.perUserLimit && userUsageCount.length >= coupon.perUserLimit) {
    return { valid: false, reason: "You have already used this coupon" };
  }

  // Check minimum purchase
  if (coupon.minPurchaseAmount && amount < coupon.minPurchaseAmount) {
    return { valid: false, reason: "Minimum purchase not met" };
  }

  // Check plan applicability
  if (coupon.applicablePlanIds && !coupon.applicablePlanIds.includes(planId)) {
    return { valid: false, reason: "Coupon not applicable to this plan" };
  }

  // Check user segment
  if (coupon.userSegment === "new_users") {
    const userAge = NOW - user.createdAt;
    if (userAge > 7 * 24 * 60 * 60 * 1000) {
      return { valid: false, reason: "Coupon only for new users" };
    }
  }

  return { valid: true };
};
```

### All-Access Plans

Some plans include all courses (unlimited access):

- Store included courses in `subscriptionAllAccessCourses`
- When user has subscription with all-access plan, they access all courses
- No separate enrollment needed; subscription grants access

### Query Patterns

```typescript
// Get user's active subscription
db.select()
  .from(userSubscriptions)
  .innerJoin(
    subscriptionPlans,
    eq(userSubscriptions.planId, subscriptionPlans.id),
  )
  .where(
    and(
      eq(userSubscriptions.userId, userId),
      eq(userSubscriptions.status, "active"),
    ),
  )
  .limit(1);

// Get courses included in plan
db.select()
  .from(courses)
  .innerJoin(
    subscriptionAllAccessCourses,
    eq(courses.id, subscriptionAllAccessCourses.courseId),
  )
  .where(eq(subscriptionAllAccessCourses.planId, planId));

// Find active coupons for user
db.select()
  .from(coupons)
  .where(
    and(
      eq(coupons.isActive, true),
      gt(coupons.validUntil, NOW),
      or(
        eq(coupons.userSegment, "all"),
        // other segment checks
      ),
    ),
  );
```

### Webhook Events from Stripe

- `customer.subscription.updated` - Update user_subscriptions status
- `customer.subscription.deleted` - Set status to canceled
- `charge.refunded` - Create refund record
- `invoice.payment_failed` - Update payment status to failed

### Refund Handling

Consider adding refunds table:

- Track refund requests
- Track refund processing
- Link to original payments
- Compliance with refund policies

### Testing Considerations

- Test subscription creation with Stripe
- Test payment creation and status updates
- Test coupon validation and application
- Test subscription cancellation and reactivation
- Test trial period logic
- Test all-access course access
- Test coupon limits and segment filtering
- Test payment retry on failure
- Test webhook event handling

### Performance Notes

- Index on (user_id) for finding active subscription
- Partial index on active subscriptions: `WHERE status = 'active'`
- Partial index on active coupons: `WHERE is_active = true AND valid_until > NOW`
- Cache user's active subscription in session/Redis

### Compliance

- Store PCI-compliant data only (no card numbers)
- Stripe handles payment processing
- Store receipt URLs for user download
- Maintain audit trail of all payment changes
- Support account data deletion (GDPR)
