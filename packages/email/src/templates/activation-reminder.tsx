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
  secondaryButton,
} from './components/email-styles.js';

interface ActivationReminderEmailProps {
  userName: string;
  venueName: string;
  monthlyUrl: string;
  annualUrl: string;
  monthlyPrice?: string;
  annualPrice?: string;
  expiresInMinutes: number;
}

/**
 * Nudge for a venue who signed up but never activated (M8-T0 D-26: 24 h, 3 days,
 * 7 days).
 *
 * Deliberately the same two-button shape as the original activation email rather
 * than a "click here to resend" indirection — the venue has already decided to
 * join, so the fewest steps between this email and Stripe is the right answer.
 * Each send carries a freshly issued token, because the original will long since
 * have expired (D-17).
 */
export function ActivationReminderEmail({
  userName,
  venueName,
  monthlyUrl,
  annualUrl,
  monthlyPrice,
  annualPrice,
  expiresInMinutes,
}: ActivationReminderEmailProps) {
  return (
    <EmailLayout preview={`${venueName} is not visible to artists yet`}>
      <Text style={heading}>Your profile isn&apos;t live yet</Text>

      <Text style={bodyText}>Hi {userName || 'there'},</Text>

      <Text style={bodyText}>
        <strong>{venueName}</strong> is set up on CeolX but isn&apos;t visible to artists yet,
        because the subscription hasn&apos;t been started. Choose how you&apos;d like to be billed
        and your free trial begins straight away — you won&apos;t be charged until it ends.
      </Text>

      <Section style={buttonSection}>
        <Button href={monthlyUrl} style={primaryButton}>
          {monthlyPrice ? `Subscribe monthly — ${monthlyPrice}` : 'Subscribe monthly'}
        </Button>
      </Section>

      <Section style={buttonSection}>
        <Button href={annualUrl} style={secondaryButton}>
          {annualPrice ? `Subscribe annually — ${annualPrice}` : 'Subscribe annually'}
        </Button>
      </Section>

      <Text style={mutedText}>
        These links expire in {expiresInMinutes} minutes, and replace any links we sent you earlier.
        If you&apos;d rather not continue, you can ignore this — we&apos;ll stop reminding you.
      </Text>

      <Text style={fallbackText}>
        If the buttons don&apos;t work, copy and paste one of these links into your browser:
        {'\n'}
        <a href={monthlyUrl} style={inlineLink}>
          {monthlyUrl}
        </a>
        {'\n'}
        <a href={annualUrl} style={inlineLink}>
          {annualUrl}
        </a>
      </Text>
    </EmailLayout>
  );
}
