# Task: Localize Postmark Email Templates

## Description

Create transactional email templates in Postmark for all 4 supported languages (EN, ES, FR, RU). Templates must cover all user-facing emails: account verification, password reset, payment confirmation, course enrollment, instructor notifications, and subscription updates. Template selection must be automatic based on user language preference. Support templating for dynamic content (names, links, amounts, etc.).

## Affected Apps/Packages

- `services/email` (Email sending service)
- `apps/api` (Email trigger endpoints)
- `packages/postmark` (Postmark integration)

## Requirements

### Postmark Setup

- Create template per language for each email type
- Use Postmark template variables for dynamic content
- Template naming convention: `{EmailType}-{Language}` (e.g., `VerifyEmail-EN`)
- Store template IDs in database or environment
- Support fallback to EN if translation unavailable

### Email Types to Localize

1. **Verification Email** - Account creation/email verification
2. **Password Reset** - Forgot password recovery
3. **Welcome Email** - First login/onboarding
4. **Payment Confirmation** - Subscription/course purchase
5. **Course Enrollment** - Student enrollment notification
6. **Instructor Payout** - Monthly earnings confirmation
7. **Subscription Renewal** - Upcoming subscription renewal
8. **Course Completion** - Certificate issuance notification
9. **Community Notification** - Community engagement updates
10. **Account Deletion** - Account deletion confirmation

### Template Variables

- User name, email, username
- Course/product names
- Payment amounts, currency
- Dates and times in locale format
- Action buttons/CTAs
- Footer with contact info and legal links

### Dynamic Content

- Date/time localization per timezone
- Currency symbols per locale
- Number formatting (decimals, thousands separator)
- Links with correct language prefix (for web links)
- Personalization (user first name, etc.)

### Testing & QA

- Test email delivery for each language
- Verify dynamic content rendering
- Check HTML/plain-text versions
- Test on various email clients
- Accessibility: proper semantic HTML, alt text

## Acceptance Criteria

- [ ] 10 email templates created per language (40 total)
- [ ] All Postmark template IDs documented
- [ ] Email service sends correct template per user language
- [ ] Dynamic variables replace correctly
- [ ] Dates/times formatted per locale
- [ ] Currency symbols and amounts correct
- [ ] Action links include correct language prefix
- [ ] Plain-text fallback for all templates
- [ ] Tested in major email clients
- [ ] WCAG 2.1 Level AA accessibility verified
- [ ] Fallback to EN working if translation missing
- [ ] Analytics: Email open/click tracking enabled
- [ ] Unsubscribe links present and functional
- [ ] No hardcoded strings in templates (use variables)

## Dependencies

- Postmark account with paid plan
- Email service integration implemented
- User model with language preference
- Email sending infrastructure in place

## Technical Notes

### Postmark Template Management

**services/email/template-registry.ts:**

```typescript
export const EMAIL_TEMPLATES = {
  verify_email: {
    en: "verify-email-en",
    es: "verify-email-es",
    fr: "verify-email-fr",
    ru: "verify-email-ru",
  },
  password_reset: {
    en: "password-reset-en",
    es: "password-reset-es",
    fr: "password-reset-fr",
    ru: "password-reset-ru",
  },
  welcome: {
    en: "welcome-en",
    es: "welcome-es",
    fr: "welcome-fr",
    ru: "welcome-ru",
  },
  payment_confirmation: {
    en: "payment-confirmation-en",
    es: "payment-confirmation-es",
    fr: "payment-confirmation-fr",
    ru: "payment-confirmation-ru",
  },
  course_enrollment: {
    en: "course-enrollment-en",
    es: "course-enrollment-es",
    fr: "course-enrollment-fr",
    ru: "course-enrollment-ru",
  },
  instructor_payout: {
    en: "instructor-payout-en",
    es: "instructor-payout-es",
    fr: "instructor-payout-fr",
    ru: "instructor-payout-ru",
  },
  subscription_renewal: {
    en: "subscription-renewal-en",
    es: "subscription-renewal-es",
    fr: "subscription-renewal-fr",
    ru: "subscription-renewal-ru",
  },
  course_completion: {
    en: "course-completion-en",
    es: "course-completion-es",
    fr: "course-completion-fr",
    ru: "course-completion-ru",
  },
  community_notification: {
    en: "community-notification-en",
    es: "community-notification-es",
    fr: "community-notification-fr",
    ru: "community-notification-ru",
  },
  account_deletion: {
    en: "account-deletion-en",
    es: "account-deletion-es",
    fr: "account-deletion-fr",
    ru: "account-deletion-ru",
  },
};

export type EmailType = keyof typeof EMAIL_TEMPLATES;
export type Language = "en" | "es" | "fr" | "ru";

export const getTemplateId = (
  emailType: EmailType,
  language: Language = "en",
): string => {
  const template = EMAIL_TEMPLATES[emailType];
  return template[language] || template["en"]; // Fallback to EN
};
```

### Email Service Implementation

**services/email/postmark-service.ts:**

```typescript
import postmark from "postmark";
import { EmailType, Language, getTemplateId } from "./template-registry";

interface EmailVariables {
  [key: string]: string | number | boolean | null;
}

interface LocalizedEmailRequest {
  emailType: EmailType;
  recipientEmail: string;
  recipientLanguage: Language;
  variables: EmailVariables;
  tag?: string;
  replyTo?: string;
}

export class PostmarkEmailService {
  private client: postmark.ServerClient;

  constructor() {
    this.client = new postmark.ServerClient(process.env.POSTMARK_API_TOKEN!);
  }

  /**
   * Send localized template email
   */
  async sendTemplateEmail(request: LocalizedEmailRequest): Promise<string> {
    try {
      const {
        emailType,
        recipientEmail,
        recipientLanguage,
        variables,
        tag,
        replyTo,
      } = request;

      const templateId = getTemplateId(emailType, recipientLanguage);

      console.log(
        `Sending ${emailType} email (${recipientLanguage}) to ${recipientEmail}`,
      );

      const result = await this.client.sendEmailWithTemplate({
        From: process.env.POSTMARK_FROM_EMAIL || "noreply@mentor.example.com",
        To: recipientEmail,
        TemplateAlias: templateId,
        TemplateModel: {
          ...variables,
          language: recipientLanguage,
          currentYear: new Date().getFullYear(),
        },
        ReplyTo: replyTo,
        Tag: tag || emailType,
        TrackOpens: true,
        TrackLinks: "htmlAndText",
      });

      console.log(`Email sent successfully: ${result.MessageID}`);
      return result.MessageID;
    } catch (error) {
      console.error("Postmark send error:", error);
      throw error;
    }
  }

  /**
   * Send verification email
   */
  async sendVerificationEmail(
    email: string,
    verificationLink: string,
    language: Language,
    userName?: string,
  ): Promise<string> {
    return this.sendTemplateEmail({
      emailType: "verify_email",
      recipientEmail: email,
      recipientLanguage: language,
      variables: {
        verificationLink,
        userName: userName || "User",
      },
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(
    email: string,
    resetLink: string,
    language: Language,
    userName?: string,
  ): Promise<string> {
    return this.sendTemplateEmail({
      emailType: "password_reset",
      recipientEmail: email,
      recipientLanguage: language,
      variables: {
        resetLink,
        userName: userName || "User",
        expirationMinutes: 60,
      },
    });
  }

  /**
   * Send welcome email
   */
  async sendWelcomeEmail(
    email: string,
    language: Language,
    userName: string,
  ): Promise<string> {
    return this.sendTemplateEmail({
      emailType: "welcome",
      recipientEmail: email,
      recipientLanguage: language,
      variables: {
        userName,
        appName: "Mentor",
      },
    });
  }

  /**
   * Send payment confirmation
   */
  async sendPaymentConfirmation(
    email: string,
    language: Language,
    details: {
      orderId: string;
      amount: number;
      currency: string;
      courseName: string;
      purchaseDate: string;
      receiptLink: string;
    },
  ): Promise<string> {
    return this.sendTemplateEmail({
      emailType: "payment_confirmation",
      recipientEmail: email,
      recipientLanguage: language,
      variables: {
        ...details,
        currencySymbol: this.getCurrencySymbol(details.currency, language),
        formattedAmount: this.formatCurrency(
          details.amount,
          details.currency,
          language,
        ),
      },
    });
  }

  /**
   * Send course enrollment notification
   */
  async sendCourseEnrollment(
    email: string,
    language: Language,
    details: {
      courseName: string;
      instructorName: string;
      courseLink: string;
      userName: string;
    },
  ): Promise<string> {
    return this.sendTemplateEmail({
      emailType: "course_enrollment",
      recipientEmail: email,
      recipientLanguage: language,
      variables: {
        ...details,
      },
    });
  }

  /**
   * Send instructor payout confirmation
   */
  async sendInstructorPayout(
    email: string,
    language: Language,
    details: {
      payoutAmount: number;
      currency: string;
      payoutDate: string;
      courseEarnings: Array<{
        courseName: string;
        earnings: number;
      }>;
      instructorName: string;
    },
  ): Promise<string> {
    const coursesList = details.courseEarnings
      .map(
        (c) =>
          `${c.courseName}: ${this.formatCurrency(c.earnings, details.currency, language)}`,
      )
      .join(", ");

    return this.sendTemplateEmail({
      emailType: "instructor_payout",
      recipientEmail: email,
      recipientLanguage: language,
      variables: {
        instructorName: details.instructorName,
        payoutAmount: this.formatCurrency(
          details.payoutAmount,
          details.currency,
          language,
        ),
        currency: details.currency,
        payoutDate: this.formatDate(details.payoutDate, language),
        coursesList,
      },
    });
  }

  /**
   * Send subscription renewal notice
   */
  async sendSubscriptionRenewal(
    email: string,
    language: Language,
    details: {
      renewalDate: string;
      amount: number;
      currency: string;
      subscriptionType: string;
      userName: string;
    },
  ): Promise<string> {
    return this.sendTemplateEmail({
      emailType: "subscription_renewal",
      recipientEmail: email,
      recipientLanguage: language,
      variables: {
        ...details,
        renewalDate: this.formatDate(details.renewalDate, language),
        amount: this.formatCurrency(details.amount, details.currency, language),
      },
    });
  }

  /**
   * Send course completion / certificate
   */
  async sendCourseCompletion(
    email: string,
    language: Language,
    details: {
      userName: string;
      courseName: string;
      certificateLink: string;
      completionDate: string;
    },
  ): Promise<string> {
    return this.sendTemplateEmail({
      emailType: "course_completion",
      recipientEmail: email,
      recipientLanguage: language,
      variables: {
        ...details,
        completionDate: this.formatDate(details.completionDate, language),
      },
    });
  }

  /**
   * Send account deletion confirmation
   */
  async sendAccountDeletion(
    email: string,
    language: Language,
    userName: string,
  ): Promise<string> {
    return this.sendTemplateEmail({
      emailType: "account_deletion",
      recipientEmail: email,
      recipientLanguage: language,
      variables: {
        userName,
        deletionDate: this.formatDate(new Date().toISOString(), language),
      },
    });
  }

  // Helper methods
  private getCurrencySymbol(currency: string, language: Language): string {
    const symbols: Record<string, Record<Language, string>> = {
      USD: { en: "$", es: "$", fr: "$", ru: "$" },
      EUR: { en: "€", es: "€", fr: "€", ru: "€" },
      GBP: { en: "£", es: "£", fr: "£", ru: "£" },
      MXN: { en: "$", es: "$", fr: "$", ru: "₽" },
    };

    return symbols[currency]?.[language] || currency;
  }

  private formatCurrency(
    amount: number,
    currency: string,
    language: Language,
  ): string {
    const formatter = new Intl.NumberFormat(this.getLocaleCode(language), {
      style: "currency",
      currency,
    });

    return formatter.format(amount);
  }

  private formatDate(dateString: string, language: Language): string {
    const date = new Date(dateString);
    const formatter = new Intl.DateTimeFormat(this.getLocaleCode(language), {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    return formatter.format(date);
  }

  private getLocaleCode(language: Language): string {
    const locales: Record<Language, string> = {
      en: "en-US",
      es: "es-ES",
      fr: "fr-FR",
      ru: "ru-RU",
    };
    return locales[language];
  }
}

export const emailService = new PostmarkEmailService();
```

### Postmark Template Content

**Email Template: Verify Email - English**

```html
<!DOCTYPE html>
<html>
  <head>
    <style>
      body {
        font-family:
          -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }
      .container {
        max-width: 600px;
        margin: 0 auto;
      }
      .button {
        background-color: #6366f1;
        color: white;
        padding: 12px 24px;
        text-decoration: none;
        border-radius: 4px;
      }
      .footer {
        color: #666;
        font-size: 12px;
        margin-top: 40px;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>Verify Your Email</h1>

      <p>Hi {{userName}},</p>

      <p>
        Welcome to Mentor! Please verify your email address by clicking the
        button below:
      </p>

      <p style="text-align: center;">
        <a href="{{verificationLink}}" class="button">Verify Email</a>
      </p>

      <p>Or copy and paste this link in your browser:</p>
      <p><code>{{verificationLink}}</code></p>

      <p>This link expires in 24 hours.</p>

      <p>If you didn't create this account, please ignore this email.</p>

      <div class="footer">
        <p>© {{currentYear}} Mentor by Mentor. All rights reserved.</p>
        <p>
          <a href="https://mentor.example.com/en/privacy">Privacy Policy</a>
          |
          <a href="https://mentor.example.com/en/terms">Terms of Service</a>
        </p>
      </div>
    </div>
  </body>
</html>
```

**Email Template: Verify Email - Spanish**

```html
<!DOCTYPE html>
<html>
  <head>
    <style>
      body {
        font-family:
          -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }
      .container {
        max-width: 600px;
        margin: 0 auto;
      }
      .button {
        background-color: #6366f1;
        color: white;
        padding: 12px 24px;
        text-decoration: none;
        border-radius: 4px;
      }
      .footer {
        color: #666;
        font-size: 12px;
        margin-top: 40px;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>Verifica tu Correo Electrónico</h1>

      <p>¡Hola {{userName}}!</p>

      <p>
        ¡Bienvenido a Mentor! Por favor, verifica tu dirección de correo
        electrónico haciendo clic en el botón siguiente:
      </p>

      <p style="text-align: center;">
        <a href="{{verificationLink}}" class="button">Verificar Correo</a>
      </p>

      <p>O copia y pega este enlace en tu navegador:</p>
      <p><code>{{verificationLink}}</code></p>

      <p>Este enlace caduca en 24 horas.</p>

      <p>Si no creaste esta cuenta, ignora este correo.</p>

      <div class="footer">
        <p>
          © {{currentYear}} Mentor por Mentor. Todos los derechos reservados.
        </p>
        <p>
          <a href="https://mentor.example.com/es/privacy"
            >Política de Privacidad</a
          >
          |
          <a href="https://mentor.example.com/es/terms">Términos de Servicio</a>
        </p>
      </div>
    </div>
  </body>
</html>
```

### API Integration

**pages/api/auth/send-verification-email.ts:**

```typescript
import { NextApiRequest, NextApiResponse } from "next";
import { emailService } from "@services/email";
import { UserModel } from "@models";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { email, verificationToken } = req.body;

    if (!email || !verificationToken) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const user = await UserModel.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Build verification link
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL || "https://mentor.example.com";
    const verificationLink = `${baseUrl}/${user.language}/auth/verify?token=${verificationToken}`;

    // Send localized email
    const messageId = await emailService.sendVerificationEmail(
      email,
      verificationLink,
      user.language,
      user.firstName,
    );

    return res.status(200).json({
      message: "Verification email sent",
      messageId,
    });
  } catch (error) {
    console.error("Error sending verification email:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}
```

## Implementation Order

1. Create all 40 email templates in Postmark (4 languages × 10 types)
2. Document all template IDs
3. Implement Postmark service
4. Create email template registry
5. Implement helper methods (currency, date formatting)
6. Create API endpoints for each email type
7. Test email sending for each language
8. Test dynamic variable replacement
9. Test on major email clients (Gmail, Outlook, Apple Mail)
10. Verify accessibility compliance
11. Set up email analytics
12. Create monitoring for delivery failures
13. Document email troubleshooting guide
