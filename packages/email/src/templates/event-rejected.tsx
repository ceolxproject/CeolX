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

interface EventRejectedEmailProps {
  userName: string;
  eventTitle: string;
  reason: string;
  editUrl: string;
}

export function EventRejectedEmail({
  userName,
  eventTitle,
  reason,
  editUrl,
}: EventRejectedEmailProps) {
  return (
    <EmailLayout preview={`Action needed on "${eventTitle}" — edit and resubmit to go live again`}>
      <Text style={heading}>Your event needs revision</Text>

      <Text style={bodyText}>Hi {userName || 'there'},</Text>

      <Text style={bodyText}>
        Our moderation team removed your event <strong>"{eventTitle}"</strong> pending edits.
        Reason:
      </Text>

      <Text style={bodyText}>
        <em>{reason}</em>
      </Text>

      <Text style={bodyText}>You can edit and resubmit it from the event page.</Text>

      <Section style={buttonSection}>
        <Button href={editUrl} style={primaryButton}>
          Edit event
        </Button>
      </Section>

      <Text style={mutedText}>
        Once you resubmit, your event will go live again immediately — no further approval needed.
      </Text>

      <Text style={fallbackText}>
        Direct edit link:{' '}
        <a href={editUrl} style={inlineLink}>
          {editUrl}
        </a>
      </Text>
    </EmailLayout>
  );
}
