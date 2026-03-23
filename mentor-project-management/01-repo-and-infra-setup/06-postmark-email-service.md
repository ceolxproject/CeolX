# Task 6: Postmark Email Service Setup

## Description

Set up a centralized email service package (`@mentor/email`) using Postmark as the transactional email provider. This package provides a unified interface for sending all platform emails including authentication (verification, password reset), notifications (enrollment, comments, payouts), instructor approvals, team invitations, and GDPR-related communications (data export ready, account deletion confirmation). Includes HTML email template engine with i18n support, delivery tracking, and error handling with retry logic via QStash.

## Affected Apps/Packages

- New package: `packages/email` (`@mentor/email`)
- Backend: `apps/api` (Hono) — all routes that trigger emails
- Shared: `packages/i18n` — for email template localization
- Shared: `packages/validators` — for email input validation

## Requirements

### Postmark Configuration

- Create Postmark account and server for the Mentor platform
- Configure sender signatures for `noreply@mentor.example.com` and `support@mentor.example.com`
- Set up message streams: `outbound` (transactional) and `broadcast` (marketing/newsletters if needed later)
- Store Postmark Server API Token in environment variables (`POSTMARK_API_TOKEN`)
- Configure bounce and spam complaint webhooks

### Email Package Architecture

- Create `packages/email/` with the following structure:
  - `src/client.ts` — Postmark client initialization and singleton
  - `src/templates/` — HTML email templates (Handlebars or React Email)
  - `src/send.ts` — Core send function with error handling and logging
  - `src/types.ts` — TypeScript types for all email payloads
  - `src/constants.ts` — Template IDs, sender addresses, subject line prefixes
- Use `postmark` npm package (official SDK)
- All emails must support 4 languages (EN, ES, FR, RU) via template variants or i18n interpolation

### Email Templates Required

- **Auth emails:** Email verification, Password reset OTP, Account lockout notification, Welcome email (post-signup)
- **Learner emails:** Enrollment confirmation, Course completion certificate, Subscription confirmation, Payment receipt, Failed payment warning, Data export ready, Account deletion scheduled, Account deletion completed
- **Instructor emails:** Application received, Application approved, Application rejected, New enrollment notification, Payout processed, Team member joined, Team member removed
- **Admin emails:** New instructor application alert, Reported content alert, Data export request received, Account deletion request received
- **Team emails:** Team invitation, Team role changed

### Template Engine

- Use React Email or MJML for responsive HTML templates
- All templates must be mobile-responsive (tested on major email clients)
- Include plain-text fallback for every HTML template
- Brand styling: Use Mentor brand colors (#FF3B6B hot pink accent, #1A1A2E dark navy text)
- Include unsubscribe link where applicable (marketing emails)
- All templates must pass Postmark's template validation

### Error Handling & Reliability

- Implement retry logic for failed sends (3 retries with exponential backoff)
- Log all email sends to audit trail (recipient, template, status, timestamp)
- Handle Postmark rate limits gracefully (queue overflow to QStash)
- Track delivery status via Postmark webhooks (delivered, bounced, opened)
- Alert on high bounce rates or delivery failures

### Developer API

```typescript
// Usage example
import { sendEmail } from "@mentor/email";

await sendEmail({
  to: user.email,
  template: "email-verification",
  locale: user.preferredLanguage, // 'en' | 'es' | 'fr' | 'ru'
  data: { verificationUrl, userName },
});
```

## Acceptance Criteria

- [x] Postmark client initializes successfully with API token from env
- [x] All 4 auth-MVP email templates created with HTML and plain-text variants
- [ ] Templates render correctly in Gmail, Outlook, Apple Mail, and mobile clients — operational: requires manual cross-client QA
- [x] Each template supports all 4 languages (EN, ES, FR, RU)
- [x] `sendEmail()` function sends successfully via Postmark API
- [x] Failed sends retry via QStash (5 retries configured)
- [x] All email sends logged with recipient, template name, status, and timestamp
- [ ] Bounce and spam complaint webhooks configured and processing — operational: requires Postmark account configuration
- [x] Unit tests for template rendering with all locale variants
- [ ] Integration test confirming delivery to Postmark sandbox — operational: requires live Postmark credentials
- [x] Package exports clean TypeScript types for all email payloads
- [x] Environment variable `POSTMARK_API_TOKEN` documented in `.env`

## Dependencies

- Postmark account provisioned with verified sender domain
- `packages/i18n` initialized with locale files (Milestone 03, Task 07)
- `packages/validators` available for input validation (Milestone 03, Task 06)
- QStash setup for retry queue (see Task 07: QStash Background Jobs)

## Technical Notes

### Why Postmark?

- Industry-leading deliverability rates (99%+)
- Dedicated IP addresses for transactional email
- Built-in template management and analytics
- Webhook support for delivery tracking
- Competitive pricing for startup volume

### Template Organization

- Store templates in `packages/email/src/templates/{template-name}/{locale}.tsx`
- Each template exports both HTML and plain-text renderers
- Use shared layout components (header, footer, button, divider)

### Common Gotchas

- Postmark requires verified sender signatures before sending
- Template IDs in Postmark are server-specific, not account-wide
- Always test with Postmark's sandbox mode in development
- Rate limit: 500 emails/second per server (more than sufficient for V1)
- React Email requires Node.js runtime for SSR rendering of templates
