# Task 1: Stripe Billing Setup

## Description

Initialize Stripe Billing infrastructure for subscription management. This foundational task sets up Stripe Products and Prices for both monthly and annual subscription plans, registers webhook endpoints for payment events, and integrates the Stripe SDK into the Hono API backend.

This task ensures all subsequent subscription and payment operations have the necessary Stripe configuration in place.

## Affected Apps/Packages

- **Backend**: Hono API service (`packages/api`)
- **Infrastructure**: Stripe account and webhook infrastructure
- **Configuration**: Environment variables and secrets management

## API Endpoints

- No user-facing endpoints in this task
- Webhook endpoint: `POST /webhooks/stripe` (to be registered with Stripe)

## Requirements

### Stripe Account Setup

1. Access Stripe Dashboard with admin credentials
2. Create Products in Stripe:
   - **Product 1: "Mentor Premium - Monthly"**
     - Description: Monthly subscription to all premium courses and features
     - Image: (optional) Mentor logo/branding
   - **Product 2: "Mentor Premium - Annual"**
     - Description: Annual subscription with 2 months free equivalent (discount)
     - Image: (optional) Mentor logo/branding

3. Create Prices for each Product:
   - **Monthly Plan Price**:
     - Amount: 9.99 EUR
     - Currency: EUR
     - Billing period: Monthly (1 month)
     - Price ID: Store for reference (e.g., `price_monthly_eur`)
   - **Annual Plan Price**:
     - Amount: 99.90 EUR (equivalent to 8.33 EUR/month, 2 months savings)
     - Currency: EUR
     - Billing period: Yearly (1 year)
     - Price ID: Store for reference (e.g., `price_annual_eur`)

### Stripe SDK Integration in Backend

1. Install Stripe npm package:

   ```bash
   npm install stripe
   ```

2. Create Stripe client initialization file (`packages/api/src/lib/stripe.ts`):

   ```typescript
   import Stripe from "stripe";

   const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
     apiVersion: "2024-12-18.acacia",
     httpClient: undefined, // Use default HTTP client
   });

   export default stripe;
   ```

3. Environment variables required:
   - `STRIPE_SECRET_KEY`: Full Stripe secret key (test or live)
   - `STRIPE_PUBLISHABLE_KEY`: Public key for frontend use
   - `STRIPE_WEBHOOK_SECRET`: Secret for webhook signature verification
   - `STRIPE_PRICE_PRO_MONTHLY`: Price ID for Pro monthly plan
   - `STRIPE_PRICE_PRO_ANNUAL`: Price ID for Pro annual plan
   - `WEBHOOK_ENDPOINT`: Full URL for webhook endpoint (e.g., `https://api.mentor.example.com/webhooks/stripe`)

### Webhook Endpoint Registration

1. Create webhook endpoint handler in Hono (`packages/api/src/routes/webhooks/stripe.ts`):
   - Accept POST requests at `/webhooks/stripe`
   - Verify Stripe signature using webhook secret
   - Log all webhook events for debugging
   - Route events to appropriate handlers (implemented in separate tasks)

2. Register webhook in Stripe Dashboard:
   - Endpoint URL: Production webhook URL (e.g., `https://api.mentor.example.com/webhooks/stripe`)
   - Events to listen:
     - `checkout.session.completed`
     - `invoice.paid`
     - `invoice.payment_failed`
     - `invoice.upcoming`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `charge.refunded`
     - `entitlements.active_entitlement_summary.updated` (optional, for future use)

3. Store webhook endpoint ID and secret in environment variables

### Database Schema Considerations

- Ensure `subscriptions` table exists with Stripe fields (implementation in milestone 2)
- Ensure `users` table has `stripe_customer_id` field (implementation in milestone 2)
- Ensure `payments` table exists for transaction history (implementation in milestone 2)

## Acceptance Criteria

- [ ] Stripe account is set up with admin access and API keys
- [ ] Two Products created in Stripe (Monthly and Annual premium plans)
- [ ] Two Prices created with correct amounts (9.99 EUR monthly, 99.90 EUR annual) in EUR currency
- [ ] Stripe npm package installed in backend (`stripe` package version ^16.0.0 or later)
- [ ] Stripe client initialization file created (`packages/api/src/lib/stripe.ts`) with proper TypeScript types
- [ ] Environment variables documented and added to `.env.example`:
  - `STRIPE_SECRET_KEY`
  - `STRIPE_PUBLISHABLE_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - `STRIPE_PRICE_PRO_MONTHLY`
  - `STRIPE_PRICE_PRO_ANNUAL`
  - `WEBHOOK_ENDPOINT`
- [ ] Webhook endpoint handler skeleton created at `packages/api/src/routes/webhooks/stripe.ts`
- [ ] Webhook signature verification implemented using `stripe.webhooks.constructEvent()`
- [ ] Webhook endpoint registered in Stripe Dashboard with all required events
- [ ] Webhook secret stored securely in environment
- [ ] Test webhook delivery from Stripe Dashboard to confirm receipt (in test mode)
- [ ] API error handling for Stripe authentication failures with meaningful messages
- [ ] Documentation created with:
  - How to rotate Stripe API keys
  - How to add new products/prices
  - Webhook security best practices
  - Testing webhook delivery in development

## Dependencies

- Stripe account creation (external, must be completed before this task)
- Environment variable management infrastructure (from milestone 1)
- Database schema with user and subscription tables (from milestone 2, but can work in parallel)

## Technical Notes

### Stripe API Version

- Use latest stable Stripe API version at time of implementation
- Document version in code for future reference and upgrades

### Security Considerations

1. **Secret Management**: Never commit API keys to version control. Use environment variables only.
2. **Webhook Signature Verification**: Always verify webhook signatures using Stripe's signature header (`stripe-signature`). Use `stripe.webhooks.constructEvent()` which handles verification and parsing.
3. **Idempotency**: Implement idempotency keys for critical operations (covered in separate tasks).
4. **Retry Logic**: Stripe automatically retries webhooks on failure for 3 days. Log all webhook processing attempts for debugging.

### Testing

1. Use Stripe's test mode with test API keys for all development
2. Test webhook delivery using Stripe's webhook testing tool in Dashboard (Developers → Webhooks → Select endpoint → Send test event)
3. Use Stripe's test card numbers:
   - Success: `4242 4242 4242 4242`
   - Requires authentication: `4000 0025 0000 3155`
   - Declined: `4000 0000 0000 0002`

### Pricing Strategy Notes

- Monthly price: 9.99 EUR represents entry-level subscription
- Annual price: 99.90 EUR = 8.33 EUR/month, offering ~17% savings and incentivizing longer commitment
- All prices in EUR as per project specification
- Consider regional tax implications when activating live mode (to be handled in separate task)

### Future Considerations

1. **Multi-Currency Support** (Milestone 12 - Internationalization):
   - Create additional Prices for other currencies (GBP, USD, etc.)
   - Track currency preference per user
   - Handle currency conversion for reporting

2. **Promotional Pricing**:
   - Create additional Prices with discounts for limited-time promotions
   - Use Stripe Coupon system for flexible discounts (covered in separate task)

3. **Product Variations**:
   - Consider creating price tiers (e.g., Pro, Premium+) in future
   - Each tier would be a separate Price on same Product

### Rollback Plan

1. If Stripe configuration fails, revert to previous API keys (store backup)
2. If webhook registration fails, use alternative webhook URL temporarily
3. If prices are incorrect, create new Prices and update environment variables (old prices remain but inactive)
4. Database migrations can be reversed separately (not applicable here)

### Monitoring and Logging

1. Log all Stripe API calls with request/response (exclude sensitive fields)
2. Log webhook processing: event ID, event type, processing status, duration
3. Set up alerts for:
   - Webhook processing failures
   - Stripe API errors (rate limits, authentication)
   - Significant price/product changes in Dashboard

### Cost Implications

- Stripe pricing: 2.9% + €0.30 per successful charge (EUR payments)
- Webhook processing is free (unlimited)
