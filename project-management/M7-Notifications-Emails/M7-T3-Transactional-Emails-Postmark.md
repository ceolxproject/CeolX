# M7-T3 · Transactional Emails (Postmark)

| Field | Value |
|-------|-------|
| **Milestone** | M7 — Notifications & Emails |
| **Status** | 🔲 To Do |
| **Depends on** | M2-T1 (email verification uses Postmark), M2-T3 (password reset uses Postmark), M2-T4 (venue activation email) |
| **PRD Ref** | Section 4.1 (Auth Emails), Section 9.8 (Venue Activation Email) |

---

## Description
Centralise and finalise all Postmark transactional email templates. Several emails are already stubbed in earlier milestones (verification, password reset, venue activation) — this task creates the final production-ready templates in Postmark and wires the API to them correctly.

---

## Affected Apps / Packages
| App / Package | Role |
|---------------|------|
| `apps/api` | Postmark API client configuration, email dispatch service called throughout the codebase |

---

## API Endpoints
None — this task is an internal service/infrastructure task. No new HTTP endpoints.

---

## Requirements
- R1: Postmark account configured; API key stored as environment variable per environment (dev/staging/prod)
- R2: Separate Postmark message streams for transactional emails vs marketing (if applicable)
- R3: All email templates created in Postmark with correct branding and copy:
  - Email Verification: subject, verification link CTA
  - Password Reset: subject, reset link CTA (expires 15 min)
  - Venue Activation: subject, `ceolx.ie/subscribe` link, instructions for completing subscription
  - Booking Notification Email (optional — push is primary): booking summary
  - Payment Confirmation: Stripe payment confirmation for Venue subscription (triggered by Stripe webhook)
- R4: All outbound emails sent from a branded sender address (e.g. `hello@ceolx.ie` or `noreply@ceolx.ie`)
- R5: Email templates tested in Postmark staging environment before production use
- R6: Bounce and spam complaint handling configured in Postmark (suppress future sends to bounced addresses)

---

## Acceptance Criteria
- [ ] All email templates created and saved in Postmark dashboard
- [ ] Email Verification email sent and received on sign-up; link works
- [ ] Password Reset email sent and received; link deep-links back into app
- [ ] Venue Activation email sent and received on Venue persona selection; contains correct `ceolx.ie/subscribe` link
- [ ] Emails render correctly on mobile email clients (tested in Postmark's preview tool)
- [ ] Sender address is branded (not a Postmark default address)
- [ ] Bounce handling configured

---

## Technical Notes
- Create a shared Postmark client service in `apps/api/services/email.ts` — all parts of the codebase call this service, not Postmark directly
- Template IDs from Postmark stored as env vars (e.g. `POSTMARK_VERIFICATION_TEMPLATE_ID`)
- The Venue Activation email must NOT contain any payment URLs beyond `ceolx.ie/subscribe` — keep it clean for App Store compliance (the link lives in the email, not in the app)
- Payment Confirmation email is triggered by the Stripe webhook handler, not a user action
