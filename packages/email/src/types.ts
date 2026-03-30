export type EmailTag =
  | 'email-verification'
  | 'password-reset'
  | 'venue-activation'
  | 'payment-confirmation'
  | 'event-approved'
  | 'event-rejected'
  | 'booking-invitation'
  | 'booking-accepted'
  | 'booking-rejected'
  | 'data-export-ready';

export interface SendEmailOptions {
  to: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  tag: EmailTag;
}
