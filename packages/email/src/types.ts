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
  /**
   * Generic transactional template driven by a notification trigger's EMAIL
   * SurfaceCopy. `subject` is the matrix subject line (also rendered as the
   * heading), `body` the one/two-line message, `ctaUrl` an HTTPS deep-link
   * bridge URL that opens the relevant in-app screen. Powers the booking
   * lifecycle emails (matrix A-09..V-13) without a bespoke template per row.
   */
  notification: {
    userName: string;
    subject: string;
    body: string;
    ctaUrl: string;
  };
  /**
   * Outside-platform collaborator invite (matrix A-14). Sent to a non-platform
   * artist a venue tagged by name+email. The recipient has no account yet, so
   * there is no `userName`. `inviteUrl` is the public `ceolx.ie/invite/:token`
   * landing; the link expires in 14 days.
   */
  'collaborator-invite': {
    inviterName: string;
    eventTitle: string;
    eventDate?: string;
    inviteUrl: string;
  };
};

export type EmailTemplate = keyof EmailTemplateMap;

export interface SendEmailOptions<T extends EmailTemplate> {
  to: string;
  template: T;
  data: EmailTemplateMap[T];
}
