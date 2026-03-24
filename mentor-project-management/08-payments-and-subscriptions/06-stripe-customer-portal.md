# Task 6: Stripe Customer Portal Integration

## Description

Implement Stripe Customer Portal integration for self-service subscription management. Users can update payment methods, upgrade/downgrade plans, cancel subscriptions, view invoices, and manage billing details through Stripe's hosted portal. This task provides a secure, PCI-compliant solution for subscription management without building custom UI.

## Affected Apps/Packages

- **Backend**: Hono API service (`packages/api`)
- **Frontend**: Web app with portal redirect
- **Stripe Integration**: Stripe Billing Portal API

## API Endpoints

### POST /api/v1/subscriptions/portal

Create a redirect link to Stripe Customer Portal for authenticated user.

**Request**:

```
POST /api/v1/subscriptions/portal
Headers:
  Content-Type: application/json
  Authorization: Bearer {user_jwt_token}

Body:
{
  "returnUrl": "https://mentor.example.com/account/subscriptions" (optional)
}
```

**Response (200 OK)**:

```json
{
  "success": true,
  "data": {
    "portalUrl": "https://billing.stripe.com/p/session/test_YWNjdF8xSDVlU2RJNTBWcWtzSnFKLF9JNDZ5WjJqREpzQjVWakZpakMwM21UTXdGN1lxQlE0Ng...",
    "expiresAt": "2024-02-18T20:30:00Z"
  }
}
```

**Error Response (400 No Subscription)**:

```json
{
  "success": false,
  "error": {
    "code": "NO_ACTIVE_SUBSCRIPTION",
    "message": "User does not have an active subscription. No portal access needed."
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

### Stripe Portal Configuration

1. **Portal Feature Setup** (one-time in Stripe Dashboard):
   - Navigate to Stripe Dashboard → Settings → Billing Portal
   - Configure portal features:
     - **Products and Pricing**: Allow plan changes (upgrade, downgrade, pause)
     - **Payment Methods**: Allow users to add/remove payment methods
     - **Invoices**: Display invoice history with download links
     - **Billing Details**: Allow email and billing address updates
     - **Subscription Cancellation**: Enable subscription cancellation flow
       - Offer proration/reconciliation
       - Show retention offers (optional)
     - **Localization**: Set default language (English, with support for multi-language)

2. **Portal Branding** (optional):
   - Add Mentor logo
   - Customize colors to match brand guidelines
   - Add custom message/FAQ section

3. **Return URL Configuration**:
   - Configure default return URL for when user exits portal
   - Each session can override with custom return URL

4. **Plan Information Display**:
   - Configure what plan details display to users
   - Show pricing, billing frequency, features
   - Display next billing date and amount

### Backend Implementation

1. **Portal Session Creation**:
   - Verify user is authenticated (JWT)
   - Retrieve user's Stripe Customer ID
   - Verify Stripe Customer has active subscription (no need to create portal for non-subscribers)
   - Create Stripe Billing Portal Session:
     ```typescript
     const portalSession = await stripe.billingPortal.sessions.create({
       customer: stripeCustomerId,
       return_url: returnUrl || process.env.BILLING_PORTAL_RETURN_URL,
       configuration: process.env.STRIPE_PORTAL_CONFIGURATION_ID,
       locale: userLanguagePreference || "en", // For future i18n
     });
     ```
   - Return portal URL to frontend
   - URL is single-use (30 minute expiration by Stripe)

2. **Return URL Handling**:
   - Accept optional `returnUrl` in request
   - Validate URL to prevent open redirects (must be same domain or allowlisted)
   - Default return URL: `/account/subscriptions` page
   - Return URL configuration in Stripe session

3. **Session Management**:
   - Session expires after 30 minutes (Stripe default, non-configurable)
   - Create new session each time user clicks "Manage Subscription" button
   - No need to store session IDs (stateless)

### User Interface Integration

1. **Account Settings Page**:
   - Button/link labeled "Manage Subscription" or "Manage Billing"
   - Only shown if user has active subscription
   - Clicking navigates to backend endpoint to get portal URL
   - Backend returns portal URL
   - Frontend redirects to Stripe portal URL

2. **Portal Features Available to User**:
   - **Update Payment Method**: Add new card, delete old cards, set default
   - **Change Plan**: Upgrade/downgrade (see tasks 9, 10)
   - **View Invoices**: Download past invoices as PDF
   - **Billing Details**: Update email, billing address
   - **Cancel Subscription**: Initiate cancellation (see task 10)
   - **View Current Plan**: See current subscription details, next billing date

3. **Portal Appearance**:
   - Stripe-hosted, professionally designed
   - Mobile-responsive
   - PCI-compliant (no payment data handled by app)
   - Matches Stripe branding (customizable via configuration)

### Return URL Handling

1. **After User Exits Portal**:
   - User clicks "Return to Mentor" or "X" button
   - Stripe redirects to configured return URL
   - User should see appropriate message based on what they did:
     - Successful plan change: "Plan updated successfully"
     - Updated payment method: "Payment method updated"
     - Canceled subscription: "Subscription canceled"
     - Did nothing: Just return to subscriptions page

2. **Return URL Validation**:
   - Only allow same-domain URLs: `mentor.example.com/*`
   - Prevent open redirects to external sites
   - Use allowlist of approved return paths:
     ```typescript
     const APPROVED_RETURN_PATHS = [
       "/account/subscriptions",
       "/account/settings",
       "/dashboard",
       "/",
     ];
     ```

### Error Handling

1. **No Active Subscription**:
   - User doesn't have Stripe subscription
   - Return 400 `NO_ACTIVE_SUBSCRIPTION`
   - Message: "You don't have an active subscription"

2. **Stripe Customer Missing**:
   - User exists but no Stripe Customer ID
   - This indicates incomplete subscription setup
   - Return 500 `STRIPE_ERROR`
   - Log for debugging

3. **Stripe API Failure**:
   - Portal creation fails
   - Return 500 `SERVICE_UNAVAILABLE`
   - Retry logic in frontend

### Database Considerations

No direct database changes needed. Use existing:

- `users.stripe_customer_id`: Link to Stripe Customer
- `subscriptions.stripe_subscription_id`: Track subscription

Changes made in portal are reflected in:

- Stripe's system first (source of truth)
- Synced to local DB via webhooks (tasks 8, 9, 10)

### Security Considerations

1. **JWT Authentication**: Verify user identity before creating portal session
2. **Customer Verification**: Ensure Stripe Customer belongs to authenticated user
3. **Return URL Validation**: Prevent open redirects
4. **HTTPS Only**: Portal sessions must be created over HTTPS
5. **Rate Limiting**: Limit portal session creation (per user per minute)
6. **Session Expiration**: Stripe automatically expires sessions after 30 minutes
7. **No Sensitive Data in URL**: Portal URL is secure token, no PII in URL

### Testing

1. **Test in Stripe Test Mode**:
   - Create test subscription
   - Generate portal session
   - Verify URL format and expiration
   - Test return URL redirect

2. **Test Portal Features**:
   - Update payment method
   - View invoices
   - Update billing details
   - Attempt (but don't complete) plan changes and cancellation

3. **Test Error Scenarios**:
   - User without subscription
   - User without Stripe Customer
   - Invalid return URL
   - Expired session (wait 30+ minutes)

## Acceptance Criteria

- [ ] POST /api/v1/subscriptions/portal endpoint implemented
- [ ] JWT authentication required for portal access
- [ ] User must have active subscription to access portal
- [ ] Stripe Billing Portal Session created via Stripe API
- [ ] Portal session includes all configuration (features, locale)
- [ ] Portal URL returned to frontend with expiration time
- [ ] Return URL accepted as optional parameter
- [ ] Return URL validated to prevent open redirects
- [ ] Only same-domain URLs allowed (allowlist pattern)
- [ ] Default return URL configured (`/account/subscriptions`)
- [ ] Stripe Customer ID verified matches authenticated user
- [ ] Error handling for no active subscription (400 NO_ACTIVE_SUBSCRIPTION)
- [ ] Error handling for missing Stripe Customer (500 STRIPE_ERROR)
- [ ] Rate limiting on portal session creation
- [ ] Frontend button/link labeled "Manage Subscription"
- [ ] Button only shown if user has active subscription
- [ ] Clicking button calls backend endpoint
- [ ] Backend returns portal URL
- [ ] Frontend redirects to portal URL
- [ ] Portal provides secure Stripe-hosted interface
- [ ] Users can update payment methods in portal
- [ ] Users can view invoice history in portal
- [ ] Users can view current plan and next billing date
- [ ] Users can upgrade/downgrade plans in portal (confirmation via webhook)
- [ ] Users can cancel subscription in portal (confirmation via webhook)
- [ ] Portal is mobile-responsive
- [ ] Portal supports customization via Stripe Dashboard configuration
- [ ] Session expires after 30 minutes (Stripe default)
- [ ] All Stripe API errors properly logged
- [ ] Unit tests cover portal session creation and URL validation
- [ ] Integration tests verify portal URL generation with Stripe test mode
- [ ] API documentation includes portal endpoint and return URL handling

## Dependencies

- Task 1: Stripe Billing Setup (Stripe account and configuration)
- Task 2: Subscription Plans API (user subscription tracking)
- Milestone 2: Database schema (users and subscriptions)
- Milestone 4: User authentication (JWT validation)

## Technical Notes

### Stripe Billing Portal Architecture

- Stripe hosts portal (not custom-built)
- Portal session is temporary token (30 minute expiration)
- Each portal access requires new session creation
- Portal displays user's subscriptions from Stripe
- Changes in portal update Stripe subscription state
- Changes sync to local DB via webhooks

### Portal Session Creation Example

```typescript
async function createPortalSession(
  stripeCustomerId: string,
  returnUrl?: string,
): Promise<string> {
  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: returnUrl || process.env.BILLING_PORTAL_RETURN_URL,
    configuration: process.env.STRIPE_PORTAL_CONFIGURATION_ID,
  });

  return session.url; // https://billing.stripe.com/p/session/...
}
```

### URL Validation Pattern

```typescript
function isValidReturnUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname;
    const path = parsedUrl.pathname;

    // Check hostname
    const allowedHosts = [
      "mentor.example.com",
      "www.mentor.example.com",
      "localhost:3000", // Development
    ];

    if (!allowedHosts.includes(hostname)) {
      return false;
    }

    // Check path
    const allowedPaths = [
      "/account/subscriptions",
      "/account/settings",
      "/dashboard",
      "/",
    ];

    return allowedPaths.some((p) => path.startsWith(p));
  } catch {
    return false;
  }
}
```

### Portal Features Configuration

Configure in Stripe Dashboard which features users can access:

- **Manage payment methods**: Required for card updates
- **Change billing cycle**: Optional (if offering monthly↔annual)
- **Update billing address**: Optional but recommended
- **View invoices**: Highly recommended
- **Cancel subscription**: Must configure (with option to show retention)
- **Download invoices**: Recommended for compliance

### Multi-Language Support (Future)

```typescript
const locale = user.languagePreference || "en";
const portalSession = await stripe.billingPortal.sessions.create({
  customer: stripeCustomerId,
  return_url: returnUrl,
  locale: locale, // 'en', 'de', 'fr', 'es', etc.
});
```

### Rate Limiting

Implement rate limiting to prevent abuse:

- Max 10 portal session creations per user per hour
- Use Redis with key: `portal_session:{userId}:{hour}`
- Return 429 if exceeded

### Monitoring

1. Track portal session creation success rate
2. Monitor portal abandonment (user creates session but doesn't return)
3. Track which portal features are most used (via portal analytics in Stripe)
4. Alert on Stripe API errors
5. Monitor portal redirect success (measure via return URL hits)

### Testing with Stripe Test Mode

1. Create test subscription in Stripe test mode
2. Use test customer ID to create portal session
3. Portal URL will work in test mode
4. All portal features functional in test mode
5. Test card numbers work for payment method updates

### Transition from Custom Billing UI

If custom billing UI previously existed:

1. Archive old UI endpoints
2. Update frontend links to new portal endpoint
3. Migrate user data stored in local DB (via webhooks already sync)
4. Monitor both old and new paths during transition
5. Plan complete cutover once portal stabilized

### Limitations and Constraints

1. **Read-Only Access**: Users cannot view in custom UI without re-fetching from Stripe
2. **Portal-Driven Changes**: Trust Stripe as source of truth for subscription state
3. **No API Control**: Cannot programmatically control portal content (configure in Stripe Dashboard)
4. **Localization**: Limited to Stripe's supported languages
5. **Styling**: Limited customization (Stripe branding required)

### Future Enhancements

1. **Retention Offers**: Enable Stripe's dunning management with custom retention offers
2. **Promotion Codes**: Let users apply coupon codes in portal (Stripe feature)
3. **Usage Metrics**: Show user's usage of courses/features in portal (custom implementation)
4. **Testimonials**: Add social proof in portal return page
5. **Pause Subscription**: Allow users to pause instead of cancel (Stripe feature)
6. **Custom Domain**: Use custom domain for portal (Stripe feature in plans)

### Cost Considerations

- No additional cost for portal sessions
- Included in Stripe subscription management
- Reduces support burden (self-service)
- Increases retention via easier management
