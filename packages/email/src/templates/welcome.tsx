/** @jsxRuntime automatic @jsxImportSource react */
import { Button, Section, Text } from '@react-email/components';

import { EmailLayout } from './components/email-layout.js';
import { bodyText, buttonSection, heading, primaryButton } from './components/email-styles.js';

interface WelcomeEmailProps {
  userName: string;
  /** HTTPS redirect-bridge URL that opens the app's Discover feed. */
  ctaUrl: string;
}

const listText: React.CSSProperties = {
  ...bodyText,
  margin: '0 0 8px',
  paddingLeft: '20px',
};

export function WelcomeEmail({ userName, ctaUrl }: WelcomeEmailProps) {
  return (
    <EmailLayout preview="Welcome to CeolX — discover live music, artists, and venues near you">
      <Text style={heading}>Welcome to CeolX 🎶</Text>

      <Text style={bodyText}>Hi {userName || 'there'},</Text>

      <Text style={bodyText}>
        Welcome to CeolX — discover live music, artists, and venues happening around you.
      </Text>

      <Text style={bodyText}>You're all set. Here's what you can do right now:</Text>

      <ul style={{ margin: '0 0 16px' }}>
        <li style={listText}>Explore events near you</li>
        <li style={listText}>Follow your favourite artists and venues</li>
        <li style={listText}>Stay updated on what's live around you</li>
      </ul>

      <Section style={buttonSection}>
        <Button href={ctaUrl} style={primaryButton}>
          Open CeolX →
        </Button>
      </Section>

      <Text style={bodyText}>
        See you out there,
        {'\n'}
        The CeolX Team
      </Text>
    </EmailLayout>
  );
}
