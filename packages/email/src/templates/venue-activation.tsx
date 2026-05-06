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

interface VenueActivationEmailProps {
  userName: string;
  venueName: string;
  activationUrl: string;
}

export function VenueActivationEmail({
  userName,
  venueName,
  activationUrl,
}: VenueActivationEmailProps) {
  return (
    <EmailLayout preview={`Activate ${venueName} on CeolX — complete your Venue subscription`}>
      <Text style={heading}>Activate your Venue profile</Text>

      <Text style={bodyText}>Hi {userName || 'there'},</Text>

      <Text style={bodyText}>
        Welcome to CeolX. To make <strong>{venueName}</strong> visible to artists, complete your
        Venue subscription on the web. Tap the button below to set up your subscription and go live.
      </Text>

      <Section style={buttonSection}>
        <Button href={activationUrl} style={primaryButton}>
          Activate my subscription
        </Button>
      </Section>

      <Text style={mutedText}>
        Your profile will be live within 5 minutes of completing payment.
      </Text>

      <Text style={fallbackText}>
        If the button doesn't work, copy and paste this link into your browser:
        {'\n'}
        <a href={activationUrl} style={inlineLink}>
          {activationUrl}
        </a>
      </Text>
    </EmailLayout>
  );
}
