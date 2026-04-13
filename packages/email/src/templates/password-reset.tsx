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

interface PasswordResetEmailProps {
  userName: string;
  resetUrl: string;
}

export function PasswordResetEmail({ userName, resetUrl }: PasswordResetEmailProps) {
  return (
    <EmailLayout preview="Reset your CeolX password — tap the button to set a new password">
      <Text style={heading}>Reset your password</Text>

      <Text style={bodyText}>Hi {userName || 'there'},</Text>

      <Text style={bodyText}>
        We received a request to reset your CeolX password. Tap the button below on your mobile
        device to choose a new password. This link expires in 15 minutes.
      </Text>

      <Section style={buttonSection}>
        <Button href={resetUrl} style={primaryButton}>
          Reset my password
        </Button>
      </Section>

      <Text style={mutedText}>
        If you did not request a password reset, you can safely ignore this email — your account
        remains secure.
      </Text>

      <Text style={fallbackText}>
        If the button doesn't work, copy and paste this link into your browser:
        {'\n'}
        <a href={resetUrl} style={inlineLink}>
          {resetUrl}
        </a>
      </Text>
    </EmailLayout>
  );
}
