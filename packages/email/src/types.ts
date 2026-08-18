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
    // Two links, one per billing interval: Stripe Checkout cannot offer an
    // interval toggle inside a session, so the choice is made in the email
    // (M8-T0 D-08). Each carries the same token with a different ?plan.
    monthlyUrl: string;
    annualUrl: string;
    // Read from Stripe at send time so the quoted amount can never drift from
    // what is actually charged. Omitted if Stripe is unreachable — the buttons
    // then carry plain labels rather than an unverified price.
    monthlyPrice?: string;
    annualPrice?: string;
    expiresInMinutes: number;
  };
  // Same two-button shape as venue-activation: the venue already decided to join,
  // so the fewest steps between the nudge and Stripe is the right answer (D-26).
  'activation-reminder': {
    userName: string;
    venueName: string;
    monthlyUrl: string;
    annualUrl: string;
    monthlyPrice?: string;
    annualPrice?: string;
    expiresInMinutes: number;
  };
  // Sent 7 days before the first charge (D-30). Amount and date are read from
  // Stripe at send time — six months is long enough for pricing to change, and a
  // wrong figure here is what produces disputes.
  'trial-ending': {
    userName: string;
    venueName: string;
    amount: string;
    chargeDate: string;
    interval: string;
    manageUrl: string;
  };
  // Emailed Stripe Customer Portal link (D-45). Never stored; a new session is
  // created per request.
  'manage-subscription': {
    userName: string;
    venueName: string;
    portalUrl: string;
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
   * there is no `userName`. `inviteUrl` is the public `ceolx.com/invite/:token`
   * landing; the link expires in 14 days.
   */
  'collaborator-invite': {
    inviterName: string;
    eventTitle: string;
    eventDate?: string;
    inviteUrl: string;
  };
  /**
   * Onboarding welcome (ONB-01). Sent once to every new account at its first
   * authenticated session. `ctaUrl` is an HTTPS redirect-bridge URL that opens
   * the in-app Discover feed (web + mobile). Direct-send, not queued.
   * `userName` is optional — the sender defaults it and the template falls back
   * to "there" when the account has no display name yet (social sign-ups).
   *
   * `isVenue` adds the free-access line — venues are the only paid persona.
   * Drop the flag and its paragraph once subscriptions ship.
   */
  welcome: { userName?: string; ctaUrl: string; isVenue?: boolean };
  /**
   * GDPR erasure confirmation (matrix S-06 / A-18 / V-17). Sent to the account's
   * original email immediately after anonymisation. No CTA — the account no
   * longer exists. `userName` is the pre-erasure display name (may be empty).
   */
  'account-deleted': { userName: string };
};

export type EmailTemplate = keyof EmailTemplateMap;

export interface SendEmailOptions<T extends EmailTemplate> {
  to: string;
  template: T;
  data: EmailTemplateMap[T];
}
