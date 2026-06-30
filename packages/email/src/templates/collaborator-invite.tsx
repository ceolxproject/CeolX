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

interface CollaboratorInviteEmailProps {
  inviterName: string;
  eventTitle: string;
  eventDate?: string;
  inviteUrl: string;
}

/**
 * Matrix A-14. The recipient is an outside-platform artist with no account, so
 * the copy nudges them to join. They should sign up with the same email this
 * was sent to — that's how their pending collaborator spot gets claimed.
 */
export function CollaboratorInviteEmail({
  inviterName,
  eventTitle,
  eventDate,
  inviteUrl,
}: CollaboratorInviteEmailProps) {
  return (
    <EmailLayout preview={`${inviterName} invited you to play "${eventTitle}" on CeolX`}>
      <Text style={heading}>You've been invited to perform</Text>
      <Text style={bodyText}>Hi,</Text>
      <Text style={bodyText}>
        <strong>{inviterName}</strong> added you as a collaborator on{' '}
        <strong>"{eventTitle}"</strong>
        {eventDate ? ` on ${eventDate}` : ''}. Create a free CeolX account with this email address
        to claim your spot and manage your artist profile.
      </Text>
      <Section style={buttonSection}>
        <Button href={inviteUrl} style={primaryButton}>
          Join CeolX
        </Button>
      </Section>
      <Text style={mutedText}>This invite link expires in 14 days.</Text>
      <Text style={fallbackText}>
        If the button doesn't work, copy and paste this link into your browser:
        {'\n'}
        <a href={inviteUrl} style={inlineLink}>
          {inviteUrl}
        </a>
      </Text>
    </EmailLayout>
  );
}
