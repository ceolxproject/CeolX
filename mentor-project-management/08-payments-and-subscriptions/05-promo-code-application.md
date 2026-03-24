# Task 5: Promo Code Application (Coupons and Promotions)

## Description

Implement coupon and promo code system for applying discounts to both subscription and one-time purchases. Admins can create and manage coupon codes with percentage or fixed amount discounts, expiry dates, usage limits, and user segment targeting. Users apply coupon codes at checkout, with validation against business rules and usage restrictions.

## Affected Apps/Packages

- **Backend**: Hono API service (`packages/api`)
- **Database**: `coupons`, `coupon_uses` tables
- **Stripe Integration**: Stripe Coupon and Promotion Code resources
- **Admin Dashboard**: Super-admin panel (milestone 11)

## API Endpoints

### POST /api/v1/coupons/validate

Validate a coupon code and return discount information (called at checkout).

**Request**:

```
POST /api/v1/coupons/validate
Headers:
  Content-Type: application/json
  Authorization: Bearer {user_jwt_token}

Body:
{
  "code": "SUMMER20",
  "courseId": "course_12345abc" (optional, for one-time purchases),
  "subscriptionPlanId": "monthly" (optional, for subscriptions),
  "amount": 2999 (optional, in cents, for display purposes)
}
```

**Response (200 OK)**:

```json
{
  "success": true,
  "data": {
    "code": "SUMMER20",
    "valid": true,
    "discountType": "percentage",
    "discountValue": 20,
    "maxDiscountAmount": null,
    "applicableTo": "all_products",
    "description": "Summer 20% off promotion",
    "expiryDate": "2024-12-31",
    "remainingUses": 500,
    "isApplicable": true,
    "estimatedDiscount": {
      "type": "percentage",
      "percentOff": 20,
      "amountOff": 600,
      "originalAmount": 2999,
      "finalAmount": 2399,
      "currency": "EUR"
    }
  }
}
```

**Response (200 OK - Not Applicable)**:

```json
{
  "success": true,
  "data": {
    "code": "SUMMER20",
    "valid": true,
    "discountType": "percentage",
    "discountValue": 20,
    "applicableTo": "subscription_only",
    "expiryDate": "2024-12-31",
    "remainingUses": 500,
    "isApplicable": false,
    "reason": "This coupon is only applicable to subscriptions, not one-time purchases"
  }
}
```

**Error Response (400 Bad Request)**:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_COUPON",
    "message": "Coupon code not found"
  }
}
```

**Error Response (400 Expired)**:

```json
{
  "success": false,
  "error": {
    "code": "COUPON_EXPIRED",
    "message": "This coupon expired on 2024-12-31"
  }
}
```

**Error Response (400 Usage Limit Exceeded)**:

```json
{
  "success": false,
  "error": {
    "code": "COUPON_USAGE_LIMIT_EXCEEDED",
    "message": "This coupon has reached its maximum usage limit"
  }
}
```

**Error Response (400 User Not Eligible)**:

```json
{
  "success": false,
  "error": {
    "code": "USER_NOT_ELIGIBLE",
    "message": "This coupon is not available to your user segment"
  }
}
```

### POST /api/v1/coupons/apply

Apply coupon to checkout session (called when creating checkout/subscription).

**Request**:

```
POST /api/v1/coupons/apply
Headers:
  Content-Type: application/json
  Authorization: Bearer {user_jwt_token}

Body:
{
  "code": "SUMMER20",
  "transactionId": "cs_test_a1K2p3L4..." (checkout session or subscription ID)
}
```

**Response (200 OK)**:

```json
{
  "success": true,
  "data": {
    "code": "SUMMER20",
    "applied": true,
    "discount": {
      "type": "percentage",
      "percentOff": 20,
      "amountOff": 600,
      "finalAmount": 2399
    },
    "couponId": "coupon_123",
    "stripePromotionCodeId": "promo_1H5eSaI50VqksJqJ..."
  }
}
```

**Error Response (400 Invalid)**:

```json
{
  "success": false,
  "error": {
    "code": "COUPON_APPLICATION_FAILED",
    "message": "Failed to apply coupon to checkout session"
  }
}
```

### GET /api/v1/admin/coupons

List all coupons (admin only).

**Request**:

```
GET /api/v1/admin/coupons?page=1&limit=20&status=active
Headers:
  Authorization: Bearer {admin_jwt_token}
```

**Response (200 OK)**:

```json
{
  "success": true,
  "data": [
    {
      "id": "coupon_123",
      "code": "SUMMER20",
      "description": "Summer 20% off promotion",
      "discountType": "percentage",
      "discountValue": 20,
      "maxDiscountAmount": null,
      "applicableTo": "all_products",
      "targetSegments": ["new_users", "email_subscribers"],
      "expiryDate": "2024-12-31",
      "maxUses": 1000,
      "currentUses": 487,
      "remainingUses": 513,
      "status": "active",
      "createdAt": "2024-02-01T10:00:00Z",
      "createdBy": "admin_user_123",
      "analytics": {
        "redemptions": 487,
        "totalDiscountGiven": 57900,
        "conversionImpact": 1.23
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "pages": 3
  }
}
```

### POST /api/v1/admin/coupons

Create new coupon (admin only).

**Request**:

```
POST /api/v1/admin/coupons
Headers:
  Content-Type: application/json
  Authorization: Bearer {admin_jwt_token}

Body:
{
  "code": "SUMMER20",
  "description": "Summer 20% off promotion",
  "discountType": "percentage", // or "fixed_amount"
  "discountValue": 20, // percentage (1-100) or fixed amount in EUR
  "maxDiscountAmount": null, // optional max cap for percentage discounts
  "applicableTo": "all_products", // or "subscriptions_only", "purchases_only"
  "targetSegments": ["new_users", "email_subscribers"], // or empty for all users
  "expiryDate": "2024-12-31",
  "maxUses": 1000,
  "startDate": "2024-02-01",
  "activeImmediately": true,
  "oneTimePerUser": true,
  "metadata": {
    "campaign": "summer_campaign_2024",
    "source": "email_marketing"
  }
}
```

**Response (201 Created)**:

```json
{
  "success": true,
  "data": {
    "id": "coupon_123",
    "code": "SUMMER20",
    "description": "Summer 20% off promotion",
    "discountType": "percentage",
    "discountValue": 20,
    "applicableTo": "all_products",
    "expiryDate": "2024-12-31",
    "maxUses": 1000,
    "stripePromotionCodeId": "promo_1H5eSaI50VqksJqJ...",
    "stripeCouponId": "coupn_1H5eSaI50VqksJqJ..."
  }
}
```

### PUT /api/v1/admin/coupons/:couponId

Update coupon (admin only).

**Request**:

```
PUT /api/v1/admin/coupons/coupon_123
Headers:
  Content-Type: application/json
  Authorization: Bearer {admin_jwt_token}

Body:
{
  "description": "Updated description",
  "maxUses": 1500, // Can increase but not decrease
  "expiryDate": "2024-12-31",
  "targetSegments": ["new_users"]
}
```

**Response (200 OK)**:

```json
{
  "success": true,
  "data": {
    "id": "coupon_123",
    "code": "SUMMER20",
    "description": "Updated description",
    "maxUses": 1500,
    "expiryDate": "2024-12-31"
  }
}
```

### DELETE /api/v1/admin/coupons/:couponId

Deactivate coupon (admin only, soft delete).

**Request**:

```
DELETE /api/v1/admin/coupons/coupon_123
Headers:
  Authorization: Bearer {admin_jwt_token}
```

**Response (200 OK)**:

```json
{
  "success": true,
  "data": {
    "id": "coupon_123",
    "code": "SUMMER20",
    "status": "inactive"
  }
}
```

## Requirements

### Coupon Model and Database

1. **Database Schema**:

```sql
CREATE TABLE coupons (
  id UUID PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  discount_type VARCHAR(50) NOT NULL, -- 'percentage' or 'fixed_amount'
  discount_value INT NOT NULL, -- percentage (1-100) or amount in cents
  max_discount_amount INT, -- optional max cap for percentage discounts
  applicable_to VARCHAR(50) NOT NULL DEFAULT 'all_products', -- 'all_products', 'subscriptions_only', 'purchases_only'
  expiry_date DATE,
  max_uses INT,
  current_uses INT DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'active', -- 'active', 'inactive', 'expired'
  one_time_per_user BOOLEAN DEFAULT TRUE,
  start_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES users(id),
  metadata JSONB
);

CREATE TABLE coupon_uses (
  id UUID PRIMARY KEY,
  coupon_id UUID NOT NULL REFERENCES coupons(id),
  user_id UUID NOT NULL REFERENCES users(id),
  transaction_id VARCHAR(255) NOT NULL, -- Stripe session/subscription ID
  transaction_type VARCHAR(50) NOT NULL, -- 'subscription', 'purchase'
  discount_amount INT NOT NULL, -- discount in cents
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(coupon_id, user_id) -- If one_time_per_user
);

CREATE TABLE coupon_segments (
  id UUID PRIMARY KEY,
  coupon_id UUID NOT NULL REFERENCES coupons(id),
  segment VARCHAR(100) NOT NULL, -- 'new_users', 'email_subscribers', 'vip', etc.
  PRIMARY KEY (coupon_id, segment)
);

CREATE INDEX idx_coupons_code ON coupons(code);
CREATE INDEX idx_coupons_status ON coupons(status);
CREATE INDEX idx_coupon_uses_coupon_user ON coupon_uses(coupon_id, user_id);
```

### Coupon Validation Rules

1. **Code Validation**:
   - Code must exist in database
   - Code must be active (status != 'inactive')

2. **Expiry Validation**:
   - Current date must be on or before `expiry_date`
   - Check against today's date

3. **Usage Limit Validation**:
   - `current_uses < max_uses`
   - Check global usage limit

4. **User Eligibility Validation**:
   - If `target_segments` specified, user must be in at least one segment
   - Support segments: 'new_users', 'email_subscribers', 'vip', 'repeat_customers', custom segments
   - Empty segments list = all users eligible

5. **One-Time-Per-User Validation**:
   - If `one_time_per_user = true`, user cannot have already used this coupon
   - Check `coupon_uses` table for (coupon_id, user_id) record

6. **Product Applicability Validation**:
   - If `applicable_to = 'subscriptions_only'`, only allow for subscriptions
   - If `applicable_to = 'purchases_only'`, only allow for one-time purchases
   - If `applicable_to = 'all_products'`, allow for both

### Discount Calculation

1. **Percentage Discount**:

   ```
   discount_amount = amount * (discount_value / 100)
   if max_discount_amount:
     discount_amount = min(discount_amount, max_discount_amount)
   final_amount = amount - discount_amount
   ```

2. **Fixed Amount Discount**:
   ```
   discount_amount = discount_value (in cents)
   final_amount = amount - discount_amount
   if final_amount < 0:
     final_amount = 0 (cannot discount below 0)
   ```

### Stripe Integration

1. **Coupon Creation in Stripe**:
   - When admin creates coupon, sync to Stripe automatically
   - Create Stripe Coupon with:
     - `percent_off` or `amount_off`
     - `duration`: "once" (single use per customer)
     - `max_redemptions`: max_uses
     - `redeem_by`: expiry_date timestamp
     - `metadata`: { couponId: internal_coupon_id, campaign: ... }

2. **Promotion Code Creation in Stripe**:
   - Create Stripe Promotion Code linked to Coupon
   - `code`: matches coupon code
   - `coupon`: references Stripe Coupon
   - `max_redemptions`: max_uses
   - `restrictions`: { first_time_transaction: true } (for new customer offers, optional)

3. **Stripe API Example**:

```typescript
// Create Stripe Coupon
const stripeCoupon = await stripe.coupons.create({
  percent_off: 20,
  duration: "once",
  max_redemptions: 1000,
  redeem_by: Math.floor(new Date("2024-12-31").getTime() / 1000),
  metadata: {
    couponId: "coupon_123",
    campaign: "summer_campaign_2024",
  },
});

// Create Stripe Promotion Code
const stripePromoCode = await stripe.promotionCodes.create({
  coupon: stripeCoupon.id,
  code: "SUMMER20",
  max_redemptions: 1000,
});
```

### Validation Endpoint Integration

1. **Called from Checkout Creation**:
   - When user applies coupon at checkout, call `/coupons/validate`
   - If valid, include in checkout session request
   - If invalid, return error code to user

2. **Checkout Session Update**:
   - When creating checkout session, include validation:

   ```typescript
   if (couponCode) {
     const validation = await validateCoupon(couponCode, courseId);
     if (!validation.valid) {
       throw new InvalidCouponError(validation.reason);
     }
     // Include stripe promotion code in checkout
     checkoutSessionParams.discounts = [
       {
         promotion_code: validation.stripePromotionCodeId,
       },
     ];
   }
   ```

3. **Subscription Creation**:
   - Same validation flow for subscription checkout
   - Include promotion code in subscription creation

### Usage Tracking

1. **Record Coupon Use**:
   - After successful payment (webhook):
     - Insert record into `coupon_uses` table
     - Increment `current_uses` on coupon
     - Include discount amount for analytics

2. **Prevent Duplicate Use**:
   - Use UNIQUE constraint on (coupon_id, user_id) if one_time_per_user
   - Prevents duplicate redemptions at database level

### Analytics and Reporting

1. **Coupon Analytics**:
   - Total redemptions by coupon
   - Total discount amount given
   - Conversion impact: compare conversion rate with/without coupon
   - Revenue impact: track revenue after discount
   - Track which courses/subscriptions benefit most from coupons

2. **Admin Dashboard Metrics**:
   - Coupon redemption rate
   - Remaining uses and expiry countdown
   - Customer acquisition cost for coupons vs organic
   - Return on marketing spend (ROMS)

## Acceptance Criteria

- [ ] POST /api/v1/coupons/validate endpoint implemented
- [ ] Validation checks code existence, expiry, usage limits, user eligibility
- [ ] Validation handles percentage and fixed amount discount types
- [ ] Response includes estimated discount calculation
- [ ] Response includes reason if coupon not applicable to product type
- [ ] POST /api/v1/coupons/apply endpoint implemented
- [ ] Stripe Promotion Code linked and applied to Stripe session
- [ ] Coupon use tracked in database with user and transaction ID
- [ ] GET /api/v1/admin/coupons endpoint returns coupon list with analytics
- [ ] Pagination supported on coupon list
- [ ] POST /api/v1/admin/coupons creates coupon and syncs to Stripe
- [ ] Stripe Coupon and Promotion Code created automatically
- [ ] PUT /api/v1/admin/coupons/:couponId allows updating max_uses and expiry
- [ ] DELETE /api/v1/admin/coupons/:couponId soft deletes (deactivates)
- [ ] Database schema updated with coupons, coupon_uses, coupon_segments tables
- [ ] Code uniqueness enforced at database level
- [ ] Coupon validation rules all implemented and tested
- [ ] Percentage discount calculation correct with max_discount_amount cap
- [ ] Fixed amount discount calculation correct (no negative amounts)
- [ ] One-time-per-user validation prevents duplicate redemptions
- [ ] Target segments supported (new_users, email_subscribers, vip, etc.)
- [ ] Product applicability (subscriptions_only, purchases_only, all_products) enforced
- [ ] Stripe Coupon and Promotion Code IDs stored in database
- [ ] Usage limit incremented after successful payment (via webhook)
- [ ] Admin can view coupon analytics (redemptions, discount given, conversion impact)
- [ ] User cannot apply expired coupon
- [ ] User cannot apply coupon beyond usage limit
- [ ] User cannot apply coupon not applicable to product type
- [ ] JWT authentication required for validation and apply endpoints
- [ ] Admin authentication required for CRUD endpoints
- [ ] Error handling covers all validation failure scenarios
- [ ] All error codes documented and include helpful messages
- [ ] Unit tests cover validation rules, discount calculation, user eligibility
- [ ] Integration tests verify Stripe Coupon creation and application
- [ ] API documentation includes coupon creation/validation examples

## Dependencies

- Task 2: Subscription Plans API (integration with subscription checkout)
- Task 3: Stripe Checkout One-Time (integration with one-time purchase)
- Milestone 2: Database schema for users
- Milestone 4: User authentication (JWT validation)
- Milestone 11: Super-admin panel (CRUD interface for coupons)

## Technical Notes

### User Segment Targeting

Segments are flexible and can be dynamically defined:

- **Predefined Segments**: new_users, email_subscribers, vip, repeat_customers
- **Custom Segments**: Admins can create custom targeting groups
- **Segment Determination**: Function to check if user belongs to segment:

```typescript
function isUserInSegment(user: User, segment: string): boolean {
  const segmentChecks: Record<string, (u: User) => boolean> = {
    new_users: (u) => u.createdAt > thirtyDaysAgo,
    email_subscribers: (u) => u.emailSubscribed === true,
    vip: (u) => u.vipTier !== null,
    repeat_customers: (u) => u.totalPurchases > 0,
  };

  return segmentChecks[segment]?.(user) ?? false;
}
```

### Coupon Code Best Practices

1. **Code Format**: Uppercase alphanumeric, 6-20 characters (e.g., SUMMER20, WELCOME10)
2. **Uniqueness**: Enforce at database level
3. **Human Readable**: Avoid similar-looking characters (0/O, 1/I, etc.)
4. **Expiry Strategy**: Typically 30-90 days for promotions, longer for loyalty
5. **Usage Limits**: Prevent unlimited usage (set sensible defaults)

### Discount Strategy Recommendations

- **New User Discount**: 20% off first subscription (target: new_users)
- **Email Subscriber Discount**: 10% off any purchase (target: email_subscribers)
- **Seasonal Promotion**: 15% off limited time (target: all_products)
- **Referral Bonus**: Fixed EUR 5 off (target: referred_customers)
- **Win-Back Campaign**: 25% off for churned users (target: inactive_users)

### Performance Optimization

1. Cache valid coupon codes in Redis (refresh on admin update)
2. Index on code for quick lookups
3. Index on status for quick status filtering
4. Batch coupon use increments if high volume (eventual consistency acceptable)

### Testing Scenarios

1. Valid percentage discount coupon
2. Valid fixed amount discount coupon
3. Expired coupon (rejected)
4. Usage limit exceeded (rejected)
5. User not in target segment (rejected)
6. User already used one-time coupon (rejected)
7. Not applicable to product type (rejected)
8. Multiple coupons (only first applied, or combined?)
9. Discount exceeds amount (capped at 0)

### Stripe Synchronization Strategy

1. **Create in Stripe First**: Stripe IDs required for checkout
2. **Store IDs Locally**: Reference in database
3. **Update Carefully**: Some Stripe fields immutable (code, discount value)
4. **Deactivation**: Soft delete locally, restrict in Stripe via max_redemptions

### Error Handling

Return specific error codes for debugging:

- `INVALID_COUPON`: Code not found
- `COUPON_EXPIRED`: Past expiry date
- `COUPON_USAGE_LIMIT_EXCEEDED`: Max uses reached
- `USER_NOT_ELIGIBLE`: Not in target segment
- `USER_ALREADY_USED`: One-time coupon already used
- `COUPON_NOT_APPLICABLE`: Not for this product type
- `COUPON_INACTIVE`: Deactivated by admin

### Future Enhancements

1. **Multiple Coupon Stacking**: Allow combining multiple coupons
2. **Dynamic Pricing Rules**: Conditional discounts based on amount or product
3. **Coupon Personalization**: AI-driven personalized coupon offers
4. **Referral Program**: Coupon-based referral rewards
5. **Tiered Discounts**: Volume-based pricing (buy more, get more discount)
6. **Bundle Coupons**: Discount for purchasing multiple courses together
