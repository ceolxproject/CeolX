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
  secondaryButton,
} from './components/email-styles.js';

interface TrialEndingEmailProps {
  userName: string;
  venueName: string;
  /** Formatted amount that will actually be charged, read from Stripe at send time. */
  amount: string;
  /** Formatted date of the first charge. */
  chargeDate: string;
  /** Billing interval in words, e.g. "monthly" or "annual". */
  interval: string;
  /** Emailed Stripe Customer Portal link, for cancelling or changing plan. */
  manageUrl: string;
}

/**
 * Sent 7 days before the first charge (M8-T0 D-30).
 *
 * This is the most consequential email in the whole flow. The trial runs for six
 * months, so the charge lands long after the venue has forgotten signing up — an
 * unannounced debit at that distance is precisely how chargebacks happen, and D-51
 * makes a chargeback expensive for them as well as us.
 *
 * It therefore leads with the amount and the date rather than burying them, and
 * gives an unambiguous way out. Nothing here is a dark pattern: a venue who wants
 * to cancel should find that easier than replying to ask how.
 */
export function TrialEndingEmail({
  userName,
  venueName,
  amount,
  chargeDate,
  interval,
  manageUrl,
}: TrialEndingEmailProps) {
  return (
    <EmailLayout preview={`Your CeolX trial ends soon — ${amount} on ${chargeDate}`}>
      <Text style={heading}>Your free trial ends soon</Text>

      <Text style={bodyText}>Hi {userName || 'there'},</Text>

      <Text style={bodyText}>
        The free trial for <strong>{venueName}</strong> is coming to an end. On{' '}
        <strong>{chargeDate}</strong> we&apos;ll charge <strong>{amount}</strong> to the card you
        saved, and your {interval} subscription will continue from there.
      </Text>

      <Text style={bodyText}>
        You don&apos;t need to do anything if you&apos;re happy to continue — your profile stays
        live and nothing changes.
      </Text>

      <Section style={buttonSection}>
        <Button href={manageUrl} style={secondaryButton}>
          Manage or cancel
        </Button>
      </Section>

      <Text style={mutedText}>
        If your card has changed since you signed up, please update it before {chargeDate} so the
        payment doesn&apos;t fail.
      </Text>

      <Text style={fallbackText}>
        If the button doesn&apos;t work, copy and paste this link into your browser:
        {'\n'}
        <a href={manageUrl} style={inlineLink}>
          {manageUrl}
        </a>
      </Text>
    </EmailLayout>
  );
}
