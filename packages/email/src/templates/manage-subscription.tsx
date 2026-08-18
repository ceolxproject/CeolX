/** @jsxRuntime automatic @jsxImportSource react */
import { Button, Section, Text } from '@react-email/components';

import { EmailLayout } from './components/email-layout.js';
import {
  bodyText,
  buttonSection,
  fallbackText,
  heading,
  inlineLink,
  mutedText,
  primaryButton,
} from './components/email-styles.js';

interface ManageSubscriptionEmailProps {
  userName: string;
  venueName: string;
  /** Freshly created Stripe Customer Portal session URL. Never stored or reused. */
  portalUrl: string;
}

/**
 * Sent when a venue taps Manage Subscription in the app (M8-T0 D-45).
 *
 * The link is emailed rather than opened in the app for the same reason as
 * activation (D-16): no payment or billing URL may appear in the app on either
 * store. Everything the venue can do — change card, cancel, switch interval,
 * download invoices — happens on Stripe's own hosted Portal, so we build no
 * billing screens at all.
 *
 * Portal sessions are short-lived by design, so this email is worth acting on
 * promptly and a stale one simply needs re-requesting.
 */
export function ManageSubscriptionEmail({
  userName,
  venueName,
  portalUrl,
}: ManageSubscriptionEmailProps) {
  return (
    <EmailLayout preview={`Manage the CeolX subscription for ${venueName}`}>
      <Text style={heading}>Manage your subscription</Text>

      <Text style={bodyText}>Hi {userName || 'there'},</Text>

      <Text style={bodyText}>
        Here&apos;s your secure link to manage billing for <strong>{venueName}</strong>. You can
        update your card, switch between monthly and annual, download invoices, or cancel.
      </Text>

      <Section style={buttonSection}>
        <Button href={portalUrl} style={primaryButton}>
          Manage subscription
        </Button>
      </Section>

      <Text style={mutedText}>
        This link is single-use and expires shortly. If it stops working, tap Manage Subscription in
        the app again for a fresh one.
      </Text>

      <Text style={fallbackText}>
        If the button doesn&apos;t work, copy and paste this link into your browser:
        {'\n'}
        <a href={portalUrl} style={inlineLink}>
          {portalUrl}
        </a>
      </Text>
    </EmailLayout>
  );
}
