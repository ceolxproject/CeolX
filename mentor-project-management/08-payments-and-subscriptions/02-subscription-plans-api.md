# Task 2: Subscription Plans API

## Description

Implement API endpoints for listing available subscription plans and creating subscription checkout sessions. This task provides the foundation for users to view subscription options, initiate subscriptions, and access their subscription status.

## Affected Apps/Packages

- **Backend**: Hono API service (`packages/api`)
- **Database**: `subscriptions`, `users` tables
- **Stripe Integration**: Stripe Billing and Checkout

## API Endpoints

### GET /api/v1/subscriptions/plans

Retrieve all available subscription plans with pricing and features.

**Request**:

```
GET /api/v1/subscriptions/plans
Headers:
  Content-Type: application/json
  (Optional) Accept-Language: en-US
```

**Response (200 OK)**:

```json
{
  "success": true,
  "data": [
    {
      "id": "monthly",
      "name": "Premium Monthly",
      "description": "Monthly subscription to all premium courses and features",
      "price": {
        "amount": 999,
        "currency": "EUR",
        "formattedAmount": "9.99 EUR"
      },
      "billingPeriod": "monthly",
      "stripePriceId": "price_1H5eSaI50VqksJqJ...",
      "features": [
        "Access to all premium courses",
        "HD video quality",
        "Offline downloads (14 days)",
        "Priority support"
      ],
      "popular": false
    },
    {
      "id": "annual",
      "name": "Premium Annual",
      "description": "Annual subscription with 2 months savings",
      "price": {
        "amount": 9990,
        "currency": "EUR",
        "formattedAmount": "99.90 EUR"
      },
      "billingPeriod": "annual",
      "stripePriceId": "price_1H5eSbI50VqksJqJ...",
      "features": [
        "Access to all premium courses",
        "HD video quality",
        "Offline downloads (90 days)",
        "Priority support",
        "Exclusive member community"
      ],
      "popular": true,
      "savings": {
        "percentOff": 17,
        "label": "Save 17%"
      }
    }
  ]
}
```

**Error Response (500 Internal Server Error)**:

```json
{
  "success": false,
  "error": {
    "code": "STRIPE_ERROR",
    "message": "Failed to fetch plans from Stripe"
  }
}
```

### POST /api/v1/subscriptions/create

Create a Stripe Checkout session for subscription initiation.

**Request**:

```
POST /api/v1/subscriptions/create
Headers:
  Content-Type: application/json
  Authorization: Bearer {user_jwt_token}

Body:
{
  "priceId": "price_1H5eSaI50VqksJqJ...",
  "planId": "monthly",
  "successUrl": "https://mentor.example.com/dashboard?session_id={CHECKOUT_SESSION_ID}",
  "cancelUrl": "https://mentor.example.com/pricing",
  "couponCode": "SUMMER2024" (optional)
}
```

**Response (200 OK)**:

```json
{
  "success": true,
  "data": {
    "sessionId": "cs_test_a1K2p3L4...",
    "url": "https://checkout.stripe.com/pay/cs_test_a1K2p3L4...",
    "expiresAt": "2024-02-25T10:30:00Z"
  }
}
```

**Error Response (400 Bad Request)**:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Invalid priceId or planId"
  }
}
```

**Error Response (401 Unauthorized)**:

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "User not authenticated"
  }
}
```

### GET /api/v1/subscriptions/status

Get current subscription status for authenticated user.

**Request**:

```
GET /api/v1/subscriptions/status
Headers:
  Authorization: Bearer {user_jwt_token}
```

**Response (200 OK)**:

```json
{
  "success": true,
  "data": {
    "hasActiveSubscription": true,
    "plan": {
      "id": "annual",
      "name": "Premium Annual",
      "stripePriceId": "price_1H5eSbI50VqksJqJ...",
      "price": {
        "amount": 9990,
        "currency": "EUR",
        "formattedAmount": "99.90 EUR"
      }
    },
    "subscription": {
      "id": "sub_1H5eSdI50VqksJqJ...",
      "status": "active",
      "currentPeriodStart": "2024-02-18T10:30:00Z",
      "currentPeriodEnd": "2025-02-18T10:30:00Z",
      "cancelAtPeriodEnd": false,
      "lastPaymentDate": "2024-02-18T10:30:00Z",
      "nextPaymentDate": "2025-02-18T10:30:00Z"
    },
    "customer": {
      "stripeCustomerId": "cus_1H5eSdI50VqksJqJ...",
      "email": "user@example.com"
    },
    "daysUntilRenewal": 365
  }
}
```

**Response (200 OK - No Subscription)**:

```json
{
  "success": true,
  "data": {
    "hasActiveSubscription": false,
    "plan": null,
    "subscription": null,
    "customer": {
      "stripeCustomerId": null,
      "email": "user@example.com"
    }
  }
}
```

**Error Response (401 Unauthorized)**:

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "User not authenticated"
  }
}
```

## Requirements

### Backend Implementation

1. **Plan Retrieval Logic**:
   - Fetch plans from Stripe Products and Prices (cache for performance, refresh every 24 hours)
   - Include feature list from product description or metadata
   - Mark annual plan as "popular" via metadata flag
   - Calculate and display savings percentage (17% for annual vs monthly)

2. **Stripe Customer Creation**:
   - When user initiates subscription checkout, create or retrieve Stripe Customer
   - Link Stripe Customer ID to user record in database
   - Use customer email and user metadata (ID, name) in Stripe Customer creation

3. **Checkout Session Creation**:
   - Accept priceId, planId, successUrl, cancelUrl, and optional couponCode
   - Create Stripe Checkout session with:
     - `payment_method_types`: ["card"] (initially, expand in future for more payment methods)
     - `mode`: "subscription"
     - `customer`: Stripe customer ID (created if not exists)
     - `success_url` and `cancel_url`: URLs passed from client
     - `client_reference_id`: User ID for tracking
     - `metadata`: Include user ID, plan ID, source (web/mobile)
   - If couponCode provided, validate and apply (see promo-code-application task)
   - Return checkout session ID, URL, and expiration time

4. **Subscription Status Tracking**:
   - Retrieve active subscription from Stripe for authenticated user
   - Calculate days until renewal based on `current_period_end`
   - Include next payment date and last payment date
   - Include cancellation status (cancel_at_period_end flag)
   - Return appropriate response if no active subscription exists

### Database Schema (if not already present)

```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  stripe_subscription_id VARCHAR(255) UNIQUE NOT NULL,
  stripe_customer_id VARCHAR(255) NOT NULL,
  plan_id VARCHAR(50) NOT NULL, -- 'monthly' or 'annual'
  status VARCHAR(50) NOT NULL, -- 'active', 'past_due', 'canceled', 'unpaid'
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  canceled_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE users ADD COLUMN stripe_customer_id VARCHAR(255);
```

### Error Handling

1. Stripe API failures:
   - Catch Stripe SDK errors with meaningful messages
   - Log full error details for debugging (excluding sensitive data)
   - Return 500 with appropriate error code to client

2. Validation errors:
   - Validate priceId against known Stripe prices
   - Validate planId against supported plans
   - Return 400 with validation error details

3. Authentication errors:
   - Verify JWT token validity
   - Return 401 if user not authenticated

### Caching Strategy

1. **Plan List Caching**:
   - Fetch plans from Stripe on startup and cache in memory
   - Refresh every 24 hours via scheduled task
   - Implement fallback to cached data if Stripe API fails
   - Include cache metadata (fetched_at, expires_at) in response

2. **Subscription Status Caching**:
   - Fetch from Stripe API directly (real-time requirement)
   - Cache for 5 minutes per user to reduce API calls
   - Invalidate cache when webhook updates subscription

### Testing Scenarios

1. Test plan retrieval with Stripe test keys
2. Test checkout session creation with valid prices
3. Test coupon code application in checkout (integration with task 5)
4. Test subscription status for active, canceled, and non-existent subscriptions
5. Test error handling for invalid inputs
6. Test performance with plan caching strategy

## Acceptance Criteria

- [ ] GET /api/v1/subscriptions/plans endpoint implemented and returns correct plan data
- [ ] Plan list includes monthly and annual options with correct pricing (9.99 EUR and 99.90 EUR)
- [ ] Annual plan marked as "popular" with 17% savings label
- [ ] Features list included for each plan in response
- [ ] POST /api/v1/subscriptions/create endpoint implemented
- [ ] Stripe Customer created automatically for new users (linked to user record)
- [ ] Checkout session created with correct parameters (mode: subscription)
- [ ] Success and cancel URLs properly templated and returned
- [ ] Session expiration time included in response
- [ ] GET /api/v1/subscriptions/status endpoint returns accurate subscription state
- [ ] Subscription status correctly shows active, canceled, or no subscription states
- [ ] Days until renewal calculated and included in response
- [ ] Plan caching implemented with 24-hour refresh for plan list
- [ ] Real-time Stripe API calls for subscription status
- [ ] Proper error handling with meaningful error codes and messages
- [ ] JWT authentication required for subscription creation and status endpoints
- [ ] Coupon code parameter accepted in create endpoint (validation in task 5)
- [ ] Database schema updated with subscriptions table and stripe_customer_id field on users
- [ ] All Stripe API errors properly logged and monitored
- [ ] Unit tests cover plan retrieval, checkout session creation, subscription status
- [ ] Integration tests verify Stripe API interactions
- [ ] API documentation updated with endpoint specifications and examples

## Dependencies

- Task 1: Stripe Billing Setup (Stripe account, Products, Prices, environment variables)
- Milestone 2: Database schema for users and subscriptions tables
- Milestone 4: User authentication (JWT validation)
- Task 5: Promo Code Application (coupon validation integration)

## Technical Notes

### Stripe Session Expiration

- Checkout sessions expire after 24 hours
- No need for manual expiration tracking, Stripe handles it
- Return `expires_at` in response for UI countdown timer

### Subscription Status States

| Stripe Status | User-Facing    | Description                                                                                |
| ------------- | -------------- | ------------------------------------------------------------------------------------------ |
| `active`      | Active         | Subscription active, payments processing normally                                          |
| `past_due`    | Payment Issue  | Payment failed, retry in progress or about to be attempted                                 |
| `unpaid`      | Payment Failed | All retries exhausted, subscription suspended                                              |
| `canceled`    | Canceled       | Subscription intentionally canceled (active until period end if cancel_at_period_end=true) |

### Calculating Days Until Renewal

```typescript
const daysUntilRenewal = Math.ceil(
  (new Date(subscription.current_period_end).getTime() - Date.now()) /
    (1000 * 60 * 60 * 24),
);
```

### Performance Optimization

1. Use Stripe's `expand` parameter to retrieve related objects in single API call
2. Implement pagination for plan list if exceeding 100 items (future-proofing)
3. Cache plan list at application startup to reduce latency
4. Consider CDN for static plan information

### Future Enhancements

1. **Multiple Payment Methods**: Extend `payment_method_types` to include wallet payments (Apple Pay, Google Pay in milestone 14)
2. **Regional Pricing**: Different prices per currency (milestone 12)
3. **Custom Offers**: Allow admins to create temporary promotional pricing
4. **Dunning Management**: Implement smart dunning for failed payments (advanced feature)

### Security Considerations

1. Always use HTTPS for success/cancel URLs
2. Validate URLs to prevent open redirect vulnerabilities
3. Include session_id in success URL for verification (not sensitive data)
4. Client reference ID ties checkout session to user for internal tracking
5. Metadata included for audit and analytics purposes

### Monitoring and Alerts

1. Alert if plan fetch from Stripe fails (fallback to cache)
2. Monitor checkout session creation error rate
3. Track conversion funnel: plans viewed → checkout initiated → payment completed
4. Log all Stripe API calls with timing information for performance monitoring
