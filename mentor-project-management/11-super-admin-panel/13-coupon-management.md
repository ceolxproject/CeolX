# Coupon Management

## Description

Complete coupon code CRUD with creation, discount configuration, expiry/usage limits, user segment targeting, usage analytics, deactivation, and Stripe synchronization. Supports percentage and fixed amount discounts, redemption tracking, and campaign ROI metrics.

## Affected Apps/Packages

- Frontend: `apps/web-admin` (Next.js)
- Backend: `apps/hono-api` (Hono)
- Shared: `packages/shared` (types)
- Payments: Stripe API integration

## API Endpoints

- `GET /api/admin/coupons` — List all coupons with usage stats
- `POST /api/admin/coupons` — Create new coupon
- `GET /api/admin/coupons/:id` — Get coupon details
- `PATCH /api/admin/coupons/:id` — Update coupon (before activation)
- `POST /api/admin/coupons/:id/activate` — Activate coupon for use
- `POST /api/admin/coupons/:id/deactivate` — Deactivate coupon (no new usage)
- `DELETE /api/admin/coupons/:id` — Delete draft coupon
- `GET /api/admin/coupons/:id/usage` — Get detailed usage analytics
- `POST /api/admin/coupons/sync-stripe` — Sync coupons to Stripe
- `GET /api/admin/coupons/:code/validate` — Validate coupon for customer

## Requirements

- Coupons list with columns: code, discount (% or amount), expiry date, usage limit, current uses, status (active/inactive/expired), segment, created date
- Search/filter: by code, status, discount type, created date, expiry
- Create coupon form with:
  - Code (must be unique, alphanumeric with optional hyphens)
  - Discount type: Percentage (%) or Fixed Amount ($)
  - Discount value: 1-100 for %, 0.01-9999 for amount
  - Currency (USD for fixed amount)
  - Expiry date (optional, future date)
  - Usage limit: max redemptions (optional, no limit if blank)
  - One-time use per customer (toggle)
  - Target segment: All Users, Subscribed, Inactive, New Customers, Custom List (email/user ID list)
  - Optional: minimum purchase amount to apply coupon
  - Optional: link to promotional campaign/banner for tracking
  - Notes/description field (internal)
- Edit coupon form: update all fields except code (code immutable after creation)
- Activate coupon: transition from draft to active
- Deactivate coupon: prevents new redemptions, doesn't affect past
- Usage analytics showing:
  - Total redemptions
  - Revenue impact (total discounts given, net revenue after discount)
  - Click-through rate (if linked to banner)
  - Redemptions by segment
  - Redemption timeline (chart)
  - Average discount per redemption
- Stripe sync: automatic creation of Stripe Coupon object on activation
- Expiration handling: auto-deactivate expired coupons
- Bulk actions: create multiple coupons (CSV upload), deactivate multiple coupons
- Validation: coupon not applied if limit reached, expiry passed, customer ineligible, min purchase not met

## Acceptance Criteria

- [ ] Coupons list displays with code, discount, expiry, uses, status, segment
- [ ] Filter by status (active/inactive/expired), discount type (% or $), segment
- [ ] Search by coupon code
- [ ] Sortable columns: code, discount, expiry, uses, status
- [ ] Create coupon form accepts all fields (code, discount, expiry, limit, segment, etc.)
- [ ] Code validation: alphanumeric + hyphens, unique
- [ ] Discount type selector: toggle between % and fixed amount
- [ ] Discount value validation: 1-100 for %, 0.01-9999 for amount
- [ ] Expiry date picker allows future date only
- [ ] Usage limit input (optional): number or leave blank for unlimited
- [ ] Segment selector: All Users, Subscribed, Inactive, New, Custom (with list upload)
- [ ] One-time-per-customer toggle available
- [ ] Activate button changes status to active, syncs to Stripe
- [ ] Deactivate button prevents new redemptions
- [ ] Edit form available for draft and active coupons (except code field)
- [ ] Usage analytics page shows total redemptions, revenue impact, timeline chart
- [ ] Redemptions filtered by time period (default last 30 days)
- [ ] Expired coupons auto-marked as expired and deactivated
- [ ] Stripe Coupon object created with matching discount on activation
- [ ] Audit trail logs all create/edit/activate/deactivate actions
- [ ] Error handling for duplicate codes, invalid dates, invalid discount values
- [ ] Mobile: forms and analytics are readable

## Dependencies

- Database tables: coupons, coupon_redemptions, coupon_segments, audit_logs
- Stripe API (Coupon endpoint)
- User segmentation logic
- Payment/checkout system to enforce coupon validation

## Technical Notes

- **Coupon Status**: Enum: draft, active, inactive, expired, deleted
- **Discount Type**: Enum: PERCENTAGE, FIXED_AMOUNT
- **Code**: Alphanumeric with optional hyphens, case-insensitive, unique constraint
- **Redemption Logic**: When checkout validates coupon:
  1. Check coupon.status = 'active'
  2. Check expiry_date is null OR expiry_date > today
  3. If usage_limit set: COUNT(redemptions) < usage_limit
  4. If one_time_per_customer: user hasn't redeemed this coupon before
  5. If min_purchase_amount: order_total >= min_purchase_amount
  6. Check user is in target segment
- **Segment Targeting**: Store in coupon_segments table with coupon_id, segment_type (ALL, SUBSCRIBED, INACTIVE, CUSTOM), custom_user_ids (for CUSTOM type)
- **Usage Tracking**: Log each redemption in coupon_redemptions table with: id, coupon_id, user_id, order_id, redeemed_at, discount_amount
- **Revenue Impact**: SUM(discount_amount) from coupon_redemptions, net revenue = order_total - discount_amount
- **Stripe Sync**: On activate, POST to Stripe with discount_type, discount_value, duration='once', max_redemptions (if limit set), redeem_by (if expiry set)
- **One-Time Per Customer**: unique constraint or application logic on coupon_redemptions (coupon_id, user_id)
- **Expiry Auto-Deactivate**: Scheduled job to check for expired coupons daily and set status='expired'
- **CSV Bulk Create**: Parse CSV with columns: code, discount_type, discount_value, expiry_date, limit, segment; validate each and create
- **Campaign Linking**: Optional campaign_id or promo_banner_id field for ROI tracking
- **Audit Log**: Log code, discount, segment, expiry, admin_id for all changes
