export type EmailTag =
  | "email-verification"
  | "password-reset"
  | "venue-activation"
  | "payment-confirmation";

export interface SendEmailOptions {
  to: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  tag: EmailTag;
}
