# M8-T1 · Stripe Subscription Web Flow (ceolx.ie/subscribe)

| Field | Value |
|-------|-------|
| **Milestone** | M8 — Venue Subscription |
| **Status** | 🔲 To Do |
| **Depends on** | M1-T5 (admin scaffold — /subscribe route), M2-T4 (venue persona + activation email) |
| **PRD Ref** | Section 9.8 (Venue Subscription Flow), Section 4.3 (Persona Switching) |

---

## Description
The Venue subscription is handled entirely on the web — never in-app (Apple Rule 3.1.1 prohibits third-party payment processors for digital purchases). Venues are directed to `ceolx.ie/subscribe` via a Postmark email. They log in with their CeolX credentials and complete Stripe Checkout. The Stripe webhook then activates the Venue profile.

---

## Affected Apps / Packages
| App / Package | Role |
|---------------|------|
| `apps/admin` | `/subscribe` public page — Stripe Checkout integration |
| `apps/api` | Stripe Checkout session creation endpoint, Stripe webhook handler |

---

## API Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/stripe/create-checkout-session` | Create Stripe Checkout session for Venue subscription |
| POST | `/webhooks/stripe` | Handle Stripe webhook events (subscription activated) |

---

## Requirements
- R1: `/subscribe` page on `ceolx.ie` is publicly accessible — no admin auth required
- R2: Venue logs in with CeolX credentials on the `/subscribe` page to associate the payment with their account
- R3: On authentication, the page calls `POST /stripe/create-checkout-session` → API creates a Stripe Checkout session → returns a checkout URL → page redirects Venue to Stripe
- R4: Stripe Checkout session configured for a recurring subscription (monthly or annual — per client pricing decision)
- R5: On successful payment, Stripe sends a `checkout.session.completed` or `customer.subscription.updated` webhook to `POST /webhooks/stripe`
- R6: Webhook handler validates the Stripe signature, then sets `venue_profiles.subscription_status = active`
- R7: App detects subscription activation on next refresh (polling or WebSocket — polling acceptable for V1)
- R8: In-app pending state shows: *"Your profile is not yet visible to artists. Check your email to activate."* + **Resend Email** button — no external URL shown in app

---

## Acceptance Criteria
- [ ] `/subscribe` page renders without admin login
- [ ] Venue logs in with CeolX credentials on the page
- [ ] Clicking subscribe redirects to Stripe Checkout
- [ ] Completing Stripe Checkout triggers webhook
- [ ] Webhook sets `subscription_status = active` on the correct venue profile
- [ ] App reflects activated status on next poll/refresh
- [ ] Webhook signature validation rejects tampered payloads
- [ ] Resend Email button in-app resends the Postmark activation email

---

## Technical Notes
- The `/subscribe` page lives in `apps/admin` under the App Router's public layout (no sidebar — per M1-T5)
- Stripe secret key and webhook signing secret stored as env vars — never committed to source
- The `/webhooks/stripe` endpoint must be raw body (not JSON-parsed) for Stripe signature verification — configure middleware accordingly in Hono
- CeolX net revenue: ~97% after Stripe fee (~2.9% + 30¢) — vs ~85% with Apple IAP. No RevenueCat involved.
