# M8-T4 · ceolx.ie/account — Venue Subscription Management Portal

| Field | Value |
|-------|-------|
| **Milestone** | M8 — Venue Subscription & Payments |
| **Status** | 🔲 To Do |
| **Depends on** | M8-T1 (Stripe checkout), M8-T2 (webhook + subscription status), M1-T5 (Next.js admin scaffold) |
| **PRD Ref** | Section 7.2 (Venue Subscription — Web-based Stripe), Section 13 (Tech Stack — Admin Dashboard) |

---

## Description
Once a Venue has subscribed, they need a self-service web portal to manage their subscription — view billing history, update payment method, and cancel. This page lives at `ceolx.ie/account` in the Next.js admin app alongside the existing `/subscribe` page. Like `/subscribe`, the URL is sent via email only and never shown inside the mobile app (Apple App Store compliance).

---

## Affected Apps / Packages
| App / Package | Role |
|---------------|------|
| `apps/admin` | `/account` route — subscription management page |
| `apps/api` | Stripe Customer Portal session endpoint |

---

## API Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/stripe/portal-session` | Create a Stripe Customer Portal session; returns the portal URL |

---

## Requirements
- R1: `/account` route requires the Venue to log in with their CeolX credentials before accessing the portal
- R2: On successful login, call Stripe's Customer Portal API to generate a short-lived portal session URL, then redirect the Venue directly to the Stripe-hosted portal
- R3: The Stripe Customer Portal provides: current subscription status, billing history (past invoices with download links), update payment method, and cancel subscription
- R4: On cancellation, Stripe fires a `customer.subscription.deleted` webhook — the existing M8-T2 webhook handler sets `subscription_status = inactive` and the Venue's profile goes dormant
- R5: A "Manage my subscription" link is included in the Postmark payment confirmation email (M7-T3) pointing to `ceolx.ie/account`
- R6: **No subscription management URL is shown inside the mobile app** — the same rule as `/subscribe` (Apple App Store compliance)
- R7: The `/account` page should handle the case where the logged-in user has no active Stripe customer record — show a message: *"No active subscription found. Check your email for the activation link or contact support."*

---

## Acceptance Criteria
- [ ] Unauthenticated users visiting `/account` are redirected to the login page
- [ ] Authenticated Venue user is redirected to the Stripe Customer Portal immediately after login
- [ ] Stripe Customer Portal shows current plan, billing history, and payment method management
- [ ] Cancelling via Stripe Portal triggers the webhook → `subscription_status = inactive` in DB
- [ ] In-app Venue profile goes dormant (banner shown) after cancellation is reflected (next foreground + poll/WebSocket)
- [ ] Payment confirmation email contains a link to `ceolx.ie/account`
- [ ] No `/account` URL is surfaced inside the mobile app

---

## Technical Notes
- Use Stripe's [Customer Portal API](https://stripe.com/docs/billing/subscriptions/customer-portal): `stripe.billingPortal.sessions.create({ customer: stripeCustomerId, return_url: 'https://ceolx.ie' })`
- Store `stripe_customer_id` on the `venue_profiles` table (add this column if not already present — check M1-T2)
- The portal session URL expires quickly — generate it on each page load, do not cache
- This page does NOT require a new Stripe product or price configuration — it uses the existing subscription the Venue already has
- Stripe Customer Portal must be enabled and configured in the Stripe Dashboard (branding, cancellation policy, allowed actions) before this works — flag as a pre-launch checklist item in M12
