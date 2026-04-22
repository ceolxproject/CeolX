/**
 * Catalogue of every transactional email template the server can dispatch.
 *
 * Keys stay URL-safe kebab-case so they can be re-used as QStash job tags,
 * Postmark message metadata, and filesystem paths.
 *
 * Each template's data shape is the full set of interpolation variables the
 * React Email component expects. Shapes mirror the `{{placeholder}}` tokens
 * drafted in the M7-T0 Notifications Matrix xlsx.
 */
export type EmailTemplateMap = {
  verification: { userName: string; verificationUrl: string };
  'password-reset': { userName: string; resetUrl: string };
  'venue-activation': {
    userName: string;
    venueName: string;
    activationUrl: string;
  };
  'payment-confirmation': {
    userName: string;
    amount: string;
    planName: string;
    nextBillingDate: string;
    manageUrl: string;
    invoiceUrl?: string;
  };
  'event-approved': {
    userName: string;
    eventTitle: string;
    eventUrl: string;
    eventDate?: string;
  };
  'event-rejected': {
    userName: string;
    eventTitle: string;
    reason: string;
    editUrl: string;
  };
};

export type EmailTemplate = keyof EmailTemplateMap;

export interface SendEmailOptions<T extends EmailTemplate> {
  to: string;
  template: T;
  data: EmailTemplateMap[T];
}
