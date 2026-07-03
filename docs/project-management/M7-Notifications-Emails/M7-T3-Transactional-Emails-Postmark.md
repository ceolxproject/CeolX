# M7-T3 · Transactional Email Templates (Postmark)

| Field          | Value                                                                                                                         |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Milestone**  | M7 — Notifications & Emails                                                                                                   |
| **Status**     | ✅ Done — PR #48                                                                                                              |
| **Depends on** | M2-T1 (email verification endpoint), M2-T3 (password reset endpoint), M2-T4 (venue persona creation), M8-T1 (Stripe checkout) |
| **PRD Ref**    | Section 4.1 (Auth Emails), Section 9.8 (Venue Subscription), Section 13 (Tech Stack)                                          |

---

## Description

Centralise and produce all transactional email templates via Postmark. Transactional emails (verification, password reset, venue activation, payment confirmation) are high-priority, triggered by user actions or system events. These differ from marketing emails: they require immediate delivery, no unsubscribe needed, and must render correctly on mobile clients. This task creates production-ready Postmark template configurations and wires the backend API to dispatch them correctly.

---

## Affected Apps / Packages

| App / Package | Role                                                                              |
| ------------- | --------------------------------------------------------------------------------- |
| `apps/api`    | Postmark client initialization, email dispatch service, template ID configuration |
| `apps/admin`  | None (templates managed in Postmark dashboard only)                               |

---

## Email Templates Required

| Template                    | Trigger                                           | Recipient        | Content                                                           |
| --------------------------- | ------------------------------------------------- | ---------------- | ----------------------------------------------------------------- |
| **Email Verification**      | User signs up                                     | User email       | Verify email link (expires 24h)                                   |
| **Password Reset**          | User clicks "Forgot Password"                     | User email       | Reset link (expires 15m), security notice                         |
| **Venue Activation**        | User selects Venue persona                        | Venue user email | `ceolx.com/subscribe` link + instructions                         |
| **Payment Confirmation**    | Stripe webhook `invoice.payment_succeeded`        | Venue user email | Invoice summary, manage link to `ceolx.com/account`, plan details |
| **Event Approved Fallback** | Event moderation approved (push failure fallback) | Artist email     | Event title, link to event, congratulations copy                  |
| **Event Rejected Fallback** | Event moderation rejected (push failure fallback) | Artist email     | Event title, rejection reason, edit/resubmit instructions         |

---

## API Endpoints

No new endpoints. Postmark dispatch is invoked internally by existing endpoints and event handlers:

- `POST /auth/sign-up` → triggers Email Verification email
- `POST /auth/forgot-password` → triggers Password Reset email
- `POST /users/venues` → triggers Venue Activation email (M2-T4)
- Stripe webhook handler → triggers Payment Confirmation email (M8-T2)
- Event moderation handler → triggers Event Approved/Rejected email as fallback (M4-T3)

---

## Requirements

### Postmark Configuration

- R1.1: Postmark account created; API key stored as `POSTMARK_API_KEY` in environment (dev/staging/prod separate keys)
- R1.2: Separate message streams for transactional vs marketing (if marketing emails added post-V1)
- R1.3: Default sender configured: `admin@ceolx.com` (no-reply address rejected by app logic for user replies)
- R1.4: All templates tested in Postmark staging environment before production promotion
- R1.5: Bounce and complaint handling enabled: suppress future sends to hard bounces and spam complaints

### Email Verification Template

- R2.1: Subject: _"Verify your CeolX email"_
- R2.2: Body includes: personalized greeting (first name if available), verification link with unique token
- R2.3: Link format: `ceolx.com/verify-email?token={{VerificationToken}}`
- R2.4: Token expires 24 hours from generation; link invalid after expiry
- R2.5: CTA button: "Verify Email" (primary color)
- R2.6: Footer: Support email link, unsubscribe not required (transactional)

### Password Reset Template

- R3.1: Subject: _"Reset your CeolX password"_
- R3.2: Body includes: security notice (_"If you didn't request this, ignore this email"_), reset link with token
- R3.3: Link format: `ceolx.com/reset-password?token={{ResetToken}}`
- R3.4: Token expires 15 minutes from generation (short window for security)
- R3.5: CTA button: "Reset Password" (primary color)
- R3.6: Fallback: plaintext token for manual entry if link doesn't work
- R3.7: Footer: Support email, unsubscribe not required

### Venue Activation Template

- R4.1: Subject: _"Activate your CeolX Venue profile"_
- R4.2: Body includes: personalized greeting, instructions to complete subscription
- R4.3: **CRITICAL**: Link to `ceolx.com/subscribe` **ONLY in email body**, never shown in mobile app
- R4.4: Text: _"Click below to set up your subscription and make your profile visible to artists"_
- R4.5: CTA button: "Activate Profile" (primary color) → `ceolx.com/subscribe`
- R4.6: Expected timeline: "Your profile will be live within 5 minutes of completing payment"
- R4.7: Footer: Support email, FAQ link (if available)

### Payment Confirmation Template

- R5.1: Subject: _"Payment received: CeolX subscription renewal"_
- R5.2: Body includes: personalized greeting, invoice summary (amount, plan name, billing cycle)
- R5.3: Invoice details: amount (€/currency), plan name, next billing date
- R5.4: Link to `ceolx.com/account` for subscription management (text/button: "Manage Subscription")
- R5.5: Tax/VAT info if applicable
- R5.6: Stripe invoice link (downloadable PDF) embedded or linked
- R5.7: Footer: Support email, billing FAQ

### Event Approved Fallback Template

- R6.1: Subject: _"Your event '[Event Title]' was approved!"_
- R6.2: Body: congratulations copy, event title, date/time (if available), CTA link to event
- R6.3: Link format: `ceolx.com/events/{{EventId}}` (deep link, opens in app if installed)
- R6.4: Encouragement to start promoting/sharing
- R6.5: Footer: Support email

### Event Rejected Fallback Template

- R7.1: Subject: _"Your event '[Event Title]' needs revision"_
- R7.2: Body: friendly rejection copy, reason for rejection (e.g., _"Event date is in the past"_), instructions to edit and resubmit
- R7.3: Link to edit event: `ceolx.com/events/{{EventId}}/edit`
- R7.4: Encourage resubmission with any questions
- R7.5: Footer: Support email, moderation FAQ (if available)

### Email Dispatch Service

- R8.1: Create shared Postmark client service in `apps/server/services/email.ts` — all code paths call this, not Postmark directly
- R8.2: Template IDs from Postmark stored as env vars: `POSTMARK_VERIFICATION_TEMPLATE_ID`, `POSTMARK_PASSWORD_RESET_TEMPLATE_ID`, etc.
- R8.3: Send via `postmark.sendEmailWithTemplate({ From, To, TemplateAlias, TemplateModel })`
- R8.4: All transactional emails sent within **5 seconds** of trigger (no queueing for V1; queue if latency becomes issue)
- R8.5: Errors logged but don't block the original transaction (e.g., failed email doesn't prevent account creation)
- R8.6: Retry on failure: 1 automatic retry after 3 seconds; log after 2nd failure

---

## Acceptance Criteria

- [ ] Postmark account configured; API key in environment variables
- [ ] All 6 email templates created in Postmark dashboard
- [ ] Email Verification email sent on sign-up; link renders and validates in app
- [ ] Password Reset email sent on forgot-password request; link resets password correctly
- [ ] Venue Activation email sent on Venue persona selection; contains `ceolx.com/subscribe` link only
- [ ] Payment Confirmation email sent after Stripe webhook; includes invoice details and `ceolx.com/account` link
- [ ] Event Approved fallback email sent if push notification fails
- [ ] Event Rejected fallback email sent with rejection reason visible
- [ ] All emails render correctly on iOS Mail, Gmail, Outlook (tested in Postmark preview)
- [ ] Sender address is `admin@ceolx.com` (branded, not Postmark default)
- [ ] Bounce and complaint handling enabled; future sends to bounced addresses suppressed
- [ ] Email dispatch service centralised in `apps/server/services/email.ts`

---

## Dependencies

- **Upstream**: M2-T1 (email verification), M2-T3 (password reset), M2-T4 (venue persona creation), M8-T1 (Stripe checkout), M4-T3 (event moderation)
- **Downstream**: None direct
- **External services**: Postmark (email delivery service)

---

## Technical Notes

### Postmark Client Setup

```typescript
// apps/server/services/email.ts
import postmark from 'postmark';

const client = new postmark.ServerClient(process.env.POSTMARK_API_KEY!);

interface EmailPayload {
  to: string;
  templateAlias: string;
  templateModel: Record<string, any>;
}

export async function sendEmail(payload: EmailPayload) {
  const { to, templateAlias, templateModel } = payload;

  try {
    const result = await client.sendEmailWithTemplate({
      From: 'admin@ceolx.com',
      To: to,
      TemplateAlias: templateAlias,
      TemplateModel: templateModel,
    });

    console.log(`Email sent to ${to} (MessageID: ${result.MessageID})`);
    return { success: true, messageId: result.MessageID };
  } catch (error) {
    console.error(`Failed to send email to ${to}:`, error);
    // Retry once after 3 seconds
    setTimeout(() => {
      client
        .sendEmailWithTemplate({
          From: 'admin@ceolx.com',
          To: to,
          TemplateAlias: templateAlias,
          TemplateModel: templateModel,
        })
        .catch((retryError) => {
          console.error(`Retry failed for ${to}:`, retryError);
        });
    }, 3000);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
```

### Email Verification on Sign-Up

```typescript
// apps/server/routes/v1/auth.ts
import { sendEmail } from '@/services/email';
import { generateToken } from '@/utils/tokens';

export async function signUp(email: string, password: string) {
  // Create user, hash password, etc.
  const user = await db
    .insert(users)
    .values({
      email,
      passwordHash: hashedPassword,
      isEmailVerified: false,
    })
    .returning();

  // Generate verification token (expires 24h)
  const verificationToken = generateToken(24 * 60 * 60);
  await db.insert(verificationTokens).values({
    userId: user[0].id,
    token: verificationToken,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  // Send email
  await sendEmail({
    to: email,
    templateAlias: 'email-verification',
    templateModel: {
      firstName: email.split('@')[0],
      VerificationLink: `https://ceolx.com/verify-email?token=${verificationToken}`,
    },
  });

  return { success: true, userId: user[0].id };
}
```

### Venue Activation Email

```typescript
// apps/server/routes/v1/venues.ts
import { sendEmail } from '@/services/email';

export async function createVenueProfile(userId: string, profileData: any) {
  const profile = await db
    .insert(venueProfiles)
    .values({
      userId,
      ...profileData,
      subscriptionStatus: 'inactive',
      isActive: false,
    })
    .returning();

  // Send activation email
  await sendEmail({
    to: user.email,
    templateAlias: 'venue-activation',
    templateModel: {
      venueName: profileData.name,
      ActivationLink: 'https://ceolx.com/subscribe',
    },
  });

  return profile[0];
}
```

### Payment Confirmation Email (Stripe Webhook)

```typescript
// apps/server/handlers/stripeWebhook.ts
import { sendEmail } from '@/services/email';

export async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const venue = await db.query.venueProfiles.findFirst({
    where: eq(venueProfiles.stripeCustomerId, invoice.customer as string),
  });

  if (!venue) return;

  const user = await db.query.users.findFirst({
    where: eq(users.id, venue.userId),
  });

  const amount = (invoice.amount_paid / 100).toFixed(2);
  const planName = invoice.lines.data[0]?.description || 'CeolX Subscription';

  await sendEmail({
    to: user.email,
    templateAlias: 'payment-confirmation',
    templateModel: {
      venueName: venue.name,
      Amount: `€${amount}`,
      PlanName: planName,
      NextBillingDate: new Date(invoice.period_end * 1000).toISOString().split('T')[0],
      ManageLink: 'https://ceolx.com/account',
      InvoiceLink: invoice.hosted_invoice_url,
    },
  });
}
```

### Environment Variables

```bash
# Postmark
POSTMARK_API_KEY=server_xxxxxxx
POSTMARK_VERIFICATION_TEMPLATE_ID=12345
POSTMARK_PASSWORD_RESET_TEMPLATE_ID=12346
POSTMARK_VENUE_ACTIVATION_TEMPLATE_ID=12347
POSTMARK_PAYMENT_CONFIRMATION_TEMPLATE_ID=12348
POSTMARK_EVENT_APPROVED_TEMPLATE_ID=12349
POSTMARK_EVENT_REJECTED_TEMPLATE_ID=12350
```

### Common Gotchas

**Gotcha 1: Verification link includes raw token in URL**

- Issue: Token visible in browser history/referrer header
- Fix: Token only valid for 24 hours; server validates token on `/verify-email` GET request and issues session cookie

**Gotcha 2: Password reset link too long for SMS/messaging**

- Issue: Email forwarded to user's phone as SMS; long URL gets truncated
- Fix: Keep token short (8-12 chars); provide fallback plaintext token for manual entry

**Gotcha 3: `ceolx.com/subscribe` shown inside mobile app by accident**

- Issue: Venue reads activation email, taps link inside app WebView instead of browser
- Fix: Email client opens links in browser by default; explicitly no in-app link to payment URLs per Apple Rule 3.1.1

**Gotcha 4: Emails sent without branding feel like phishing**

- Issue: Default Postmark sender address or generic copy
- Fix: Use branded sender `admin@ceolx.com`, personalize with user's first name, include support footer

**Gotcha 5: Email templates not synced across environments**

- Issue: Dev template IDs differ from staging/prod; deployment uses wrong template ID
- Fix: Env vars per environment; test email send in staging before promoting to prod
