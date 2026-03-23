# Subscription Tier Configuration

## Description

Admin interface for creating and managing subscription plans. Supports monthly and annual billing cycles, configurable pricing, team/enterprise plans, and automatic synchronization with Stripe product and price objects. Enables A/B testing of pricing and subscription packaging.

## Affected Apps/Packages

- Frontend: `apps/web-admin` (Next.js)
- Backend: `apps/hono-api` (Hono)
- Shared: `packages/shared` (types)
- Payments: Integration with Stripe API

## API Endpoints

- `GET /api/admin/subscription-tiers` — List all subscription tiers
- `POST /api/admin/subscription-tiers` — Create new tier
- `GET /api/admin/subscription-tiers/:id` — Get tier details
- `PATCH /api/admin/subscription-tiers/:id` — Update tier (name, description, features)
- `POST /api/admin/subscription-tiers/:id/pricing` — Create or update pricing (monthly, annual)
- `PATCH /api/admin/subscription-tiers/:id/pricing/:currency` — Update pricing for currency
- `POST /api/admin/subscription-tiers/:id/publish` — Make tier available for purchase
- `POST /api/admin/subscription-tiers/:id/archive` — Archive tier (no new purchases)
- `POST /api/admin/subscription-tiers/sync-stripe` — Sync all tiers to Stripe

## Requirements

- Tiers list showing: tier name, type (individual/team), monthly/annual pricing, status (active/archived), subscriber count
- Create tier form with:
  - Tier name (e.g., "Basic", "Pro", "Premium", "Enterprise")
  - Tier type: Individual (per-user) or Team (multiple seats)
  - Description for display on pricing page
  - Features list (editable bullets, e.g., "All courses", "Priority support")
  - Pricing section:
    - Monthly price (USD, optional other currencies)
    - Annual price (USD, optional other currencies)
    - Display annual savings percentage (if annual < monthly \* 12)
  - Team plan specifics (if team tier): base seat price, per-additional-seat price, max seats
  - Active toggle to enable/disable tier for new purchases
- Edit tier form: update name, description, features, pricing, active status
- Team plan configuration:
  - Base price for N seats (e.g., $99/month for 5 seats)
  - Per-additional seat price (e.g., $15/month per extra seat)
  - Max seat count (optional limit)
- Pricing history: view previous pricing, when changed
- Stripe sync: verify tiers are synced to Stripe Products and Prices
- Archive tier: prevents new subscriptions, doesn't affect existing subscribers
- Subscriber count: display active subscribers per tier
- Pricing preview: shows how pricing appears on customer-facing pricing page

## Acceptance Criteria

- [ ] Tiers list displays with name, type, pricing, status, subscriber count
- [ ] Filter by type (individual/team), status (active/archived)
- [ ] Search by tier name
- [ ] Create tier form accepts all fields (name, type, description, features, pricing)
- [ ] Pricing form accepts monthly and annual prices (USD)
- [ ] Annual savings percentage calculated and displayed if applicable
- [ ] Team tier form includes base price, per-seat price, max seats
- [ ] Active toggle enables/disables new purchases without affecting existing
- [ ] Archive tier removes from new purchase options, marks as archived
- [ ] Features list editable (add/remove/reorder bullet points)
- [ ] Pricing preview shows how tier appears on customer pricing page
- [ ] Pricing history shows previous prices with dates and who changed them
- [ ] Stripe Products and Prices auto-created/updated when tier created/modified
- [ ] Stripe stripe_product_id stored in tiers table
- [ ] Edit form only available for non-published tiers or with override confirmation
- [ ] Subscriber count updated in real-time or cached with < 5 min delay
- [ ] Audit trail logs all tier create/update/archive actions
- [ ] Mobile: forms are readable and usable on small screens

## Dependencies

- Database tables: subscription_tiers, subscription_tier_prices, subscription_tier_pricing_history
- Stripe API (Product, Price endpoints)
- User subscriptions table (to count active subscribers per tier)
- Audit log system

## Technical Notes

- **Tier Status**: Enum: draft, active, archived, discontinued
- **Tier Type**: Enum: individual, team, enterprise
- **Pricing Currency**: Support USD as primary; can extend to other currencies (store in separate row with currency_code)
- **Stripe Sync**: On tier create/update, call Stripe API to create Product (if new) and Price (always create new Price object, don't update)
  - Store stripe_product_id in subscription_tiers.stripe_product_id
  - Store stripe_price_id_monthly and stripe_price_id_annual in subscription_tier_prices
- **Annual Savings**: Calculate as (monthly_price _ 12 - annual_price) / (monthly_price _ 12) \* 100
- **Team Pricing**: base_price_per_tier is total for N base seats; price per additional seat stored separately
  - Example: $99/month for 5 seats + $15 per additional seat means:
    - 5 seats: $99
    - 10 seats: $99 + (5 \* $15) = $174
- **Archive**: Set subscription_tiers.status='archived', prevent new Stripe checkout sessions for this price
- **Pricing History**: Create subscription_tier_pricing_history table to track all price changes with timestamps
- **Subscriber Count**: Query COUNT(DISTINCT user_id) from subscriptions where subscription_tier_id=tier.id AND status='active'
- **Edit Restrictions**: Allow editing all fields even after publishing (to support price tests), but log change with admin_id
- **Validation**: Monthly and annual prices must be > 0; annual price should typically be <= monthly \* 12
