# M12-T3 · Production Deployment & Launch Monitoring

| Field          | Value                                                                                                  |
| -------------- | ------------------------------------------------------------------------------------------------------ |
| **Milestone**  | M12 — Launch Readiness                                                                                 |
| **Status**     | 🔲 To Do                                                                                               |
| **Depends on** | M12-T1 (QA passed), M12-T2 (App Store/Play Store approved)                                             |
| **PRD Ref**    | Section 4.5 (Infrastructure & Deployment), Section 10.1 (Tech Stack), GDPR (monitoring & data logging) |

---

## Description

Deploy all CeolX services to production and configure monitoring before go-live. This is the final gate before users can access the app. All environment variables, database credentials, API keys, and service configurations must match production requirements. A comprehensive pre-launch checklist verifies that every component (Hono API on Lambda, Next.js admin dashboard, Neon production database, Stripe live webhooks, Firebase FCM, Postmark, CloudFront CDN, Sentry error monitoring) is live, healthy, and tested. A smoke test workflow confirms end-to-end functionality (sign-up, event creation, moderation, booking, subscription) before public announcement. Post-launch, monitoring dashboards track error rates, latency, and user metrics to catch issues early.

---

## Affected Apps / Packages

| App / Package     | Role                                                                   |
| ----------------- | ---------------------------------------------------------------------- |
| `apps/api`        | AWS Lambda production deployment, health check endpoint, error logging |
| `apps/admin`      | Vercel or AWS production deployment, admin auth, dashboard access      |
| `apps/mobile`     | Distributed via App Store / Play Store; points to production API       |
| `packages/shared` | Compiled and deployed as part of all apps                              |

---

## API Endpoints

### GET /api/v1/health

Health check endpoint for monitoring and uptime verification. Returns immediately with no dependencies.

**Response (200 OK):**

```json
{
  "status": "ok",
  "version": "1.0.0",
  "timestamp": "2026-03-24T10:30:00Z",
  "uptime": 86400
}
```

---

## Requirements

### Database & Migrations

- R1: **Neon production database branch** created at ceolx-prod
  - Separate from staging and development branches
  - Connection string: `postgresql://user:pass@ceolx-prod.neon.tech/ceolx?sslmode=require`
  - Backups: automatic daily backups (Neon default); manual backup before go-live
- R2: **Drizzle migrations** run cleanly on production
  - Command: `pnpm migrate:prod` (runs all pending migrations from `packages/api/migrations/`)
  - Verify: all migration files executed; no errors in Neon console
  - Rollback plan: if migration fails, restore from pre-migration backup
- R3: **Database schema** matches current Drizzle schema files
  - Verify: run `drizzle-kit check` to confirm schema matches database state
- R4: **Read-only replica** (optional for V1) or dedicated read pool for heavy queries (KPI aggregations)

### API Deployment (Hono on AWS Lambda)

- R5: **Lambda function** deployed with production configuration
  - Function name: `ceolx-api-prod` or similar
  - Runtime: Node.js 20.x
  - Memory: 1024 MB (sufficient for Hono + Drizzle)
  - Timeout: 30 seconds
  - Env vars: all production keys (see below)
- R6: **API Gateway** endpoint points to Lambda: `https://api.ceolx.com/`
  - Custom domain mapping via Route 53
  - CloudFront caching disabled for `/api/*` (or very short TTL for static responses like `/health`)
- R7: **Lambda environment variables** configured (store in AWS Secrets Manager, not in code):
  ```
  DATABASE_URL=postgresql://...neon.tech/ceolx
  NODE_ENV=production
  STRIPE_SECRET_KEY=sk_live_...
  STRIPE_WEBHOOK_SECRET=whsec_...
  MUX_ACCESS_TOKEN_ID=...
  MUX_ACCESS_TOKEN_SECRET=...
  MUX_WEBHOOK_SECRET=...
  POSTMARK_API_KEY=...
  POSTMARK_FROM_EMAIL=admin@ceolx.com
  FIREBASE_PROJECT_ID=ceolx-prod
  FIREBASE_PRIVATE_KEY=...
  FIREBASE_CLIENT_EMAIL=...
  AWS_S3_BUCKET=ceolx-media-prod
  AWS_S3_REGION=eu-west-1
  BETTER_AUTH_SECRET=...
  BETTER_AUTH_URL=https://api.ceolx.com
  SESSION_SECRET=...
  ```
- R8: **CI/CD deployment** configured (GitHub Actions, AWS CodePipeline, or similar)
  - Trigger: push to `main` or `release/*` branches
  - Steps: build (compile TypeScript), test (skip if time-sensitive; or only critical tests), deploy to Lambda
  - Rollback: keep previous Lambda version; can revert in AWS console if needed
  - Deployment time: < 5 minutes from push to live

### Admin Dashboard Deployment (Next.js)

- R9: **Next.js admin dashboard** built and deployed to production
  - Hosting: Vercel (recommended for Next.js) or AWS S3 + CloudFront
  - Domain: `ceolx.com` (or `admin.ceolx.com`)
  - Environment variables: `NEXT_PUBLIC_API_URL=https://api.ceolx.com`, admin session secret
- R10: **Admin login page** accessible; login works with seeded admin account
- R11: **Admin dashboard routes** protected by admin auth middleware; non-admin access returns 401

### Environment Configuration

- R12: **All production secrets** stored securely:
  - AWS Secrets Manager (for Lambda env vars)
  - Vercel/Netlify environment variables (for admin dashboard)
  - `.env.production.local` (never committed to Git; used for local testing only)
  - 1Password or similar for team shared secrets (backup access)
- R13: **Secrets rotation policy**: Stripe keys, Postmark API key, and session secrets should be rotated every 6 months (or immediately if compromised)
- R14: **No production credentials** in GitHub, Expo build files, or version control

### External Services Configuration

- R15: **Stripe webhook** — see the M8 Stripe Configuration section below, which is
  authoritative. This entry predates M8 and had both the path and the event list wrong
  (the mount is `/api/webhooks/stripe`, and `invoice.paid`, `trial_will_end` and
  `charge.dispute.created` were missing). Configure from that section, not this one.
  - Note when testing: `stripe trigger` fabricates its own customer, so the handler
    finds no venue row and no-ops. A green trigger proves signature verification and
    routing only — it does **not** prove a state transition. Act on a real test
    subscription for that.
- R16: **Mux webhook** endpoint: `POST https://api.ceolx.com/webhooks/mux`
  - Registered in Mux Dashboard (Live environment)
  - Events subscribed: `video.asset.ready`
  - Webhook secret: stored securely; signature verified before processing
- R17: **Firebase FCM** configured with production app:
  - Firebase project: `ceolx-prod` (create in Firebase Console)
  - Service account JSON: stored in Secrets Manager
  - Credentials used by API for sending push notifications
  - Test: send a test notification to a device token; verify it arrives
- R18: **Postmark** email sending:
  - API key: live key (not test key)
  - From address: `admin@ceolx.com` (must be verified in Postmark)
  - Sending domain: ceolx.com (DNS DKIM/SPF records configured)
  - Test: send a test email from API; verify it arrives without spam filtering
- R19: **AWS S3 + CloudFront**:
  - S3 bucket: `ceolx-media-prod` in `eu-west-1` region
  - Bucket policy: private access only; CloudFront as distribution
  - CloudFront domain: `cdn.ceolx.com` (CNAME configured)
  - Test: upload a test image via presigned URL; verify it's accessible via CloudFront

### Stripe Configuration (M8 — pre-launch, mostly Dashboard; VAT needs a code change)

None of this lives in the repo, and **test-mode and live-mode are separate objects** —
configuring one does not configure the other. Verify each in live mode before launch.

- [ ] **Restricted API key**, not a secret key (M8-T0 D-65). Store as
      `STRIPE_SECRET_KEY`. Derived from every Stripe call the code actually makes —
      an earlier version of this list omitted two of them, and an under-scoped key
      fails at runtime in exactly the paths that matter least often and hurt most:

      | Resource                | Permission   | Call site |
      | ----------------------- | ------------ | --------- |
      | Prices                  | read         | `prices.retrieve` — amounts for the trial-ending and receipt emails |
      | Checkout Sessions       | write        | `checkout.sessions.create` |
      | Billing Portal Sessions | write        | `billingPortal.sessions.create` |
      | Subscriptions           | read + write | `retrieve` for the webhook re-fetch; **`cancel`** for chargeback blocks (D-51) and GDPR erasure (D-47) |
      | Charges                 | read         | `charges.retrieve` — resolves the customer behind a dispute |
      | Customers               | write        | only once `automatic_tax` + `customer_update` is enabled (D-66) |

      Webhook signature verification needs no scope — it is a local HMAC, not an API
      call. Nothing else is required: invoice data arrives inside webhook payloads and
      is never fetched, and Refunds, Tax Rates and Payment Intents are never touched.
      Keep it to this list — a compromised key scoped this way cannot issue refunds or
      read the full customer ledger.

- [ ] **Use the same restricted scopes in test mode**, not a plain `sk_test`. The point
      is to catch a missing scope locally rather than on the first live dispute: the
      `subscriptions.cancel` and `charges.retrieve` paths only fire on chargeback and
      account deletion, so an under-scoped production key could sit undetected for
      months.
- [ ] **One Product**, "CeolX Venue Subscription", with **two Prices** — €19.99/month
      and €199/year. Two Prices on one Product is correct here because they are
      billing variants of the same plan, not different tiers.
- [ ] Both Prices created with **`tax_behavior: 'inclusive'`** (D-61). This cannot be
      changed afterwards; getting it wrong means new Prices and migrating live
      subscriptions.
- [ ] 🚨 **BLOCKING — VAT is not collected, and turning it on is a CODE change** (D-66).
      This is two separate failures, and the Dashboard only fixes one of them: 1. `automatic_tax` is **not set** in `createSubscriptionCheckoutSession`
      (`packages/api/src/services/stripe.ts`). It defaults to disabled on
      API-created Sessions, and **enabling Stripe Tax in the Dashboard does not
      change that.** Someone has to add
      `automatic_tax: { enabled: true }` — plus
      `customer_update: { address: 'auto' }`, because we reuse an existing
      Customer and Stripe needs an address to determine the rate. 2. An **active Irish VAT registration** must exist in Stripe Tax.
      Either one missing means €0.00 VAT on every invoice with **no error raised**.
      With VAT-inclusive pricing (D-61) that is completely silent and indistinguishable
      from working software. Do not tick this from the Dashboard alone — read the code.
      Verify on a real test charge that VAT appears as a line on the invoice.
- [ ] **Customer Portal configuration** (D-39, D-43): - Payment method update: enabled - Invoice history: enabled - Cancellation: enabled, **at period end** - Plan switching: enabled between the monthly and annual Prices - `subscription_update.proration_behavior`: prorate — monthly→annual is
      immediate with credit - `subscription_update.schedule_at_period_end`: conditions set so a
      **downgrade** defers to the end of the paid year - Customer email update: enabled - Cancellation reason: enabled - **Verify both switch directions against a test subscription.** Getting this
      wrong means either an unwanted refund obligation (immediate downgrade) or an
      angry venue (deferred upgrade).
- [ ] 🚨 **Failed-payment retry schedule** — Settings → Billing → Subscriptions and
      emails → _Manage payments that require confirmation_ → "If a recurring payment is
      incomplete for **N days**" → **cancel the subscription**.

      **Load-bearing since D-33 was revised on 18/08/2026** — the grace window is no
      longer arithmetic in our code, it _is_ this setting. Set N to **7 days**. As of
      18/08/2026 the account default is **15 days**, so leaving it untouched silently
      doubles the free-visibility window.

      ⚠️ **LIVE-MODE ONLY — hidden in test mode and impossible to rehearse.** Verified
      18/08/2026: applying "Hide live mode settings" removes it from the page entirely.
      Our code path is identical at 7 or 15 days (`past_due` visible, `cancelled` hidden),
      so tests cover the transition; nothing can cover whether the number is right, and
      Stripe exposes no API to read it back. A human must confirm this field in live mode.

- [ ] **Stripe's customer emails enabled** — same page, _Email notifications and customer
      management_. At minimum **card payments fail** and **expiring cards**. We
      deliberately no longer handle `invoice.payment_failed` (D-64), so without these a
      venue is never told its card failed — it goes quiet and is cancelled N days later.

      ⚠️ **Also live-mode only**, so their wording and delivery cannot be checked before
      launch. "Send a reminder email 7 days before a trial ends" lives here too and must
      stay **off**: our own trial-ending sweep sends that warning, and enabling both would
      double-send. The sweep was kept precisely because a Stripe-sent version could not be
      verified in advance.

- [ ] **Webhook endpoint** registered at `POST /api/webhooks/stripe`, subscribed to:
      `customer.subscription.created`, `.updated`, `.deleted`, `.trial_will_end`,
      `invoice.paid`, `charge.dispute.created`. (`invoice.payment_failed` is no longer
      needed — see D-64.) Signing
      secret stored as `STRIPE_WEBHOOK_SECRET`.
- [ ] Consider **allowlisting Stripe's IP ranges** on the webhook endpoint as defence
      in depth alongside signature verification.
- [ ] **Pre-activated demo account** shipped in the Apple and Google review notes
      (D-27). Reviewers cannot receive the activation email, so without this they see
      a blocked screen and reject the build.
- [ ] `VENUE_GATE_ENABLED` — leave `false` until T0 **O-08** is answered and existing
      venues are back-filled. Turning it on hides every venue that is still
      `inactive`, which today is all of them.

---

### Mobile App Configuration

- R20: **EAS production channel** configured
  - `eas.json` has `production` channel
  - Builds from App Store and Play Store release versions point to production API
  - Ensure API endpoint is `https://api.ceolx.com` (not staging or dev)
- R21: **Firebase credentials** in `google-services.json` and `GoogleService-Info.plist` are production credentials
  - Verify: Firebase Console shows events from the app (after first users sign up)

### CORS Configuration

- R22: **API CORS headers** allow requests from:
  - Mobile app: `*` (Expo apps have no fixed origin) or specific iOS/Android bundle IDs if checking User-Agent
  - Admin dashboard: `https://ceolx.com`
  - Stripe webhooks: no CORS needed (server-to-server)
- R23: **Preflight requests** cached for production (Access-Control-Max-Age: 86400)

### Monitoring & Observability

- R24: **Error tracking** configured via Sentry:
  - Sentry project created for `ceolx-prod`
  - Sentry SDK integrated into Hono API (`@sentry/node`)
  - Sentry SDK integrated into Next.js admin dashboard (`@sentry/nextjs`)
  - Sentry SDK integrated into mobile app (`@sentry/react-native`)
  - Environment variable: `SENTRY_DSN=https://...@sentry.io/...`
  - Alert: Sentry sends email on new errors
- R25: **AWS CloudWatch** monitoring:
  - Lambda logs: all logs streamed to CloudWatch Logs
  - CloudWatch alarms: error rate (> 5%), duration (> 5 seconds), throttling
  - Dashboard: custom dashboard showing Lambda invocations, errors, duration percentiles
- R26: **Uptime monitoring** via AWS Route 53 Health Checks or external service (e.g., Healthchecks.io, UptimeRobot)
  - Health check: `GET https://api.ceolx.com/health` every 30 seconds
  - Alert: email if health check fails for 5 minutes
- R27: **Neon database monitoring**:
  - Connection pool usage: monitor to ensure no exhaustion
  - Slow queries: enable slow query log; alert if queries > 5 seconds
  - Storage usage: alert if nearing quota

### Smoke Test Workflow

- R28: **Before public announcement**, run a complete end-to-end smoke test:
  1. Sign up as Spectator with valid email
  2. Grant location permission → map loads with pins
  3. View an event detail
  4. Sign out and sign up as Artist
  5. Create an event with cover image upload → image uploaded to S3 and visible via CloudFront
  6. Submit event → event enters pending_review status (admin can see it)
  7. Sign up as Venue in different account
  8. Subscribe: tap "Activate" → email sent → click link → Stripe checkout in web browser
  9. Complete Stripe test transaction (use live card for final test, or plan test transaction first)
  10. Webhook fires → subscription_status = active in DB
  11. Sign in as Super Admin (production credentials)
  12. Approve pending Artist event → artist receives push notification
  13. Event appears on map for Spectators
  14. Venue can see pending booking application
  15. Artist can accept booking
  16. Both parties receive push notifications
  - **Document results**: take screenshots, note any issues, verify all flows complete without errors

### Pre-Launch Checklist

- R29: Complete checklist (mark as done before go-live):
  - [ ] Neon production database created and migrated
  - [ ] Lambda function deployed and healthy (`/health` returns 200)
  - [ ] Admin dashboard deployed and login works
  - [ ] All environment variables set in production systems
  - [ ] Stripe live webhooks registered and tested
  - [ ] Mux live webhooks registered and tested
  - [ ] Firebase FCM production configured
  - [ ] Postmark live keys configured; test email sent
  - [ ] S3 bucket private; CloudFront working
  - [ ] CORS configured for mobile and admin origins
  - [ ] Sentry error tracking live
  - [ ] CloudWatch alarms configured
  - [ ] Uptime monitoring configured
  - [ ] Smoke test completed successfully
  - [ ] Privacy Policy and ToS live at ceolx.com
  - [ ] App Store approved (awaiting release)
  - [ ] Play Store approved (awaiting release)
  - [ ] Team briefed on launch date and go-live steps

---

## Acceptance Criteria

- [ ] `GET https://api.ceolx.com/health` returns 200 OK with healthy status
- [ ] Admin dashboard accessible and login successful with production admin account
- [ ] Database migrations run successfully; schema matches current state
- [ ] All environment variables configured; no hardcoded secrets in code
- [ ] Stripe, Mux, Postmark, Firebase live credentials verified and webhooks tested
- [ ] S3 bucket accessible via CloudFront; images load without 403 errors
- [ ] End-to-end smoke test: sign-up, event creation, moderation, booking, subscription all work
- [ ] Error tracking (Sentry) receiving events from production
- [ ] CloudWatch alarms configured and tested (simulate an error, verify alert)
- [ ] Uptime monitoring reporting healthy status
- [ ] No PII or secrets exposed in logs or error messages
- [ ] Team has access to production monitoring dashboards
- [ ] Rollback plan documented and tested (e.g., revert Lambda to previous version)

---

## Dependencies

- **Upstream**: M12-T1 (QA passed); M12-T2 (App Store and Play Store approvals)
- **Downstream**: Launch announcement; user acquisition
- **External services**: AWS (Lambda, RDS/Neon), Vercel/Netlify (admin dashboard), Sentry, Stripe, Mux, Firebase, Postmark, Apple App Store, Google Play Store

---

## Technical Notes

### Deployment Script (example using GitHub Actions)

```yaml
name: Deploy to Production

on:
  push:
    branches: [main, release/*]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Set up Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '24'

      - name: Install dependencies
        run: pnpm install

      - name: Run tests (optional for speed)
        run: pnpm test

      - name: Build API
        run: pnpm build --filter=api

      - name: Deploy API to Lambda
        run: |
          # Use AWS SAM, Serverless, or AWS CLI to deploy
          aws lambda update-function-code \
            --function-name ceolx-api-prod \
            --zip-file fileb://apps/server/dist.zip \
            --region eu-west-1

      - name: Deploy Admin Dashboard
        run: |
          # Use Vercel CLI or similar
          vercel --prod --token=${{ secrets.VERCEL_TOKEN }}

      - name: Run smoke tests
        run: pnpm test:smoke

      - name: Notify Slack
        uses: slackapi/slack-github-action@v1.24
        with:
          payload: |
            { "text": "Production deployment successful" }
```

### Smoke Test Script (example)

```typescript
// tests/smoke.test.ts
import { api } from '../src/client';

describe('Production Smoke Tests', () => {
  it('should allow signup and login flow', async () => {
    const email = `test_${Date.now()}@ceolx.com`;
    const password = 'TestPassword123!';

    // Sign up
    const signupRes = await api.post('/auth/signup', {
      email,
      password,
      name: 'Test User',
      role: 'spectator',
    });
    expect(signupRes.status).toBe(201);

    // Login
    const loginRes = await api.post('/auth/login', {
      email,
      password,
    });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.session.email).toBe(email);
  });

  it('should load map events', async () => {
    const res = await api.get('/events?bounds=53.1,53.5,-7.8,-7.2');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.events)).toBe(true);
  });

  // More tests...
});
```

### Rollback Procedure (AWS Lambda)

If a critical bug is discovered post-launch:

1. Identify the previous working Lambda version (AWS Console → Versions & Aliases)
2. Update the alias `ceolx-api-prod` to point to the previous version
3. Verify health check passes
4. Notify team; start debugging the new version
5. Fix issue; retest locally and on staging
6. Redeploy to production

---

## Common Gotchas

- **Database migrations**: Test migrations on a staging environment first. A failed migration in production can cause downtime. Always have a rollback plan.

- **Stripe webhook secret**: If you change the webhook secret, update it in AWS Secrets Manager before deploying. If mismatch, Stripe events will be rejected.

- **CloudFront cache TTL**: If you set CloudFront cache TTL too high (> 24 hours), stale content will be served. For JSON API responses, use 0 TTL or no caching. For images, 30 days is fine.

- **Lambda cold start**: First request to a Lambda function after deployment can be slow (2–5 seconds cold start). Monitor and consider provisioned concurrency if slow starts affect user experience.

- **Environment variable typos**: Double-check env var names. A typo will cause the app to crash at runtime (e.g., `STRIPE_SECRET_KEY` vs `STRIPE_SECRETKEY`).

- **Time zone in logs**: Ensure all timestamps are logged in UTC. Mixing local time and UTC can cause confusion in post-incident analysis.

- **Stripe test mode in production**: Ensure you're using `sk_live_...` (production keys), not `sk_test_...` keys in production. Test keys will silently fail to charge real cards.

- **Launch timing**: Coordinate launch date with the team and Chongie Entertainment Services. Announce on social media, Irish music forums, and to media partners. Time launch around the Irish festival season (March–September) for maximum engagement.

### Live-mode Stripe Product copy (D-69)

The Checkout trial headline is Stripe's and always reads in **days** ("183 days free") — there is
no months parameter in the API, confirmed by rendering the hosted page. The "6 months" wording
therefore lives in the Product **description**, which is per-mode and does not copy across from
test:

- [ ] Set the live-mode Product description to: `Includes a 6-month free trial. Venue profile visibility and event publishing on CeolX.`

Adaptive Pricing needs no Dashboard action — D-68 disables it per-Session in code, which is
deliberate, so leaving the account toggle on is harmless.

### Live-mode Portal configuration (D-70)

The Portal configuration is per-mode. Test mode is set; **live mode still starts from Stripe's
defaults**, which means plan switching is off and — the dangerous one — `trial_update_behavior`
is `end_trial`, under which a venue switching plan mid-trial silently loses the rest of a
six-month trial and starts paying.

- [ ] `features[subscription_update][enabled]=true`
- [ ] `default_allowed_updates=[price]`
- [ ] `proration_behavior=none` (no refunds — Q5)
- [ ] `trial_update_behavior=continue_trial` ← **do not skip**
- [ ] `schedule_at_period_end.conditions=[decreasing_item_amount, shortening_interval]`

`products` needs no setting; Stripe derives the switchable prices from the catalogue.

Set in test mode 24/08/2026 and also needed live — the venue-facing polish on this page:

- [ ] `business_profile[privacy_policy_url]=https://ceolx.com/privacy`
- [ ] `business_profile[terms_of_service_url]=https://ceolx.com/terms` — without these the
      footer links are **Stripe's** own terms, not CeolX's, on a page billing an Irish business
- [ ] `features[customer_update][allowed_updates]=[tax_id, name, address]` (D-61 asked for
      `tax_id`; `name` and `address` are what make the invoice show the venue's registered
      company details). `email` is deliberately excluded so the billing address cannot drift
      away from the CeolX account email
- [ ] **Branding — Dashboard, not API** (Settings → Branding): icon, logo, brand and accent
      colour are all unset, which is why the page renders with a placeholder square and
      Stripe's default blue. This is the largest visible improvement available and the only
      one that is account-level rather than per-mode, so **verify whether it applies to test
      and live together before assuming a test-mode change is safe**.
