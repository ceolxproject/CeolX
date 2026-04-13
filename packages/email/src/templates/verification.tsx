/** @jsxImportSource react */
import { Button, Section, Text } from '@react-email/components';
import * as React from 'react';

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

interface VerificationEmailProps {
  userName: string;
  verificationUrl: string;
}

export function VerificationEmail({ userName, verificationUrl }: VerificationEmailProps) {
  return (
    <EmailLayout preview="Verify your CeolX account — tap the button to activate">
      <Text style={heading}>Verify your email</Text>

      <Text style={bodyText}>Hi {userName || 'there'},</Text>

      <Text style={bodyText}>
        Thanks for joining CeolX! Tap the button below on your mobile device to verify your email
        address and activate your account.
      </Text>

      <Section style={buttonSection}>
        <Button href={verificationUrl} style={primaryButton}>
          Verify my account
        </Button>
      </Section>

      <Text style={mutedText}>This link expires in 24 hours.</Text>

      <Text style={fallbackText}>
        If the button doesn't work, copy and paste this link into your browser:
        {'\n'}
        <a href={verificationUrl} style={inlineLink}>
          {verificationUrl}
        </a>
      </Text>
    </EmailLayout>
  );
}
