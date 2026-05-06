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

interface EventApprovedEmailProps {
  userName: string;
  eventTitle: string;
  eventUrl: string;
  eventDate?: string;
}

export function EventApprovedEmail({
  userName,
  eventTitle,
  eventUrl,
  eventDate,
}: EventApprovedEmailProps) {
  return (
    <EmailLayout preview={`"${eventTitle}" is live on CeolX`}>
      <Text style={heading}>Your event is live ✓</Text>

      <Text style={bodyText}>Hi {userName || 'there'},</Text>

      <Text style={bodyText}>
        Great news — your event <strong>"{eventTitle}"</strong>
        {eventDate ? ` on ${eventDate}` : ''} is live on CeolX. Fans can now find and save it from
        the map and feed.
      </Text>

      <Section style={buttonSection}>
        <Button href={eventUrl} style={primaryButton}>
          View event
        </Button>
      </Section>

      <Text style={mutedText}>
        Share the link with friends and followers to start drawing a crowd.
      </Text>

      <Text style={fallbackText}>
        Direct link:{' '}
        <a href={eventUrl} style={inlineLink}>
          {eventUrl}
        </a>
      </Text>
    </EmailLayout>
  );
}
