/** @jsxRuntime automatic @jsxImportSource react */
import { Button, Section, Text } from '@react-email/components';

import { EmailLayout } from './components/email-layout.js';
import {
  bodyText,
  buttonSection,
  fallbackText,
  heading,
  inlineLink,
  primaryButton,
} from './components/email-styles.js';

interface NotificationEmailProps {
  userName: string;
  subject: string;
  body: string;
  ctaUrl: string;
}

/**
 * Generic notification email. The trigger's EMAIL subject doubles as the
 * heading, the body is the one/two-line message, and the CTA points at the
 * HTTPS deep-link bridge that opens the relevant in-app screen.
 */
export function NotificationEmail({ userName, subject, body, ctaUrl }: NotificationEmailProps) {
  return (
    <EmailLayout preview={subject}>
      <Text style={heading}>{subject}</Text>
      <Text style={bodyText}>Hi {userName || 'there'},</Text>
      <Text style={bodyText}>{body}</Text>
      <Section style={buttonSection}>
        <Button href={ctaUrl} style={primaryButton}>
          View in CeolX
        </Button>
      </Section>
      <Text style={fallbackText}>
        If the button doesn't work, copy and paste this link into your browser:
        {'\n'}
        <a href={ctaUrl} style={inlineLink}>
          {ctaUrl}
        </a>
      </Text>
    </EmailLayout>
  );
}
