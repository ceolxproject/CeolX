/** @jsxImportSource react */
import { Button, Section, Text } from '@react-email/components';
import * as React from 'react';

import { EmailLayout } from './components/email-layout.js';

interface VerificationEmailProps {
  userName: string;
  verificationUrl: string;
}

export function VerificationEmail({ userName, verificationUrl }: VerificationEmailProps) {
  return (
    <EmailLayout preview="Verify your CeolX account — tap the button to activate">
      <Text style={heading}>Verify your email</Text>

      <Text style={body}>Hi {userName || 'there'},</Text>

      <Text style={body}>
        Thanks for joining CeolX! Tap the button below on your mobile device to verify your email
        address and activate your account.
      </Text>

      <Section style={buttonSection}>
        <Button href={verificationUrl} style={button}>
          Verify my account
        </Button>
      </Section>

      <Text style={expiry}>This link expires in 24 hours.</Text>

      <Text style={fallback}>
        If the button doesn't work, copy and paste this link into your browser:
        {'\n'}
        <a href={verificationUrl} style={fallbackLink}>
          {verificationUrl}
        </a>
      </Text>
    </EmailLayout>
  );
}

const heading: React.CSSProperties = {
  color: '#09090b',
  fontSize: '24px',
  fontWeight: '700',
  lineHeight: '32px',
  margin: '0 0 16px',
};

const body: React.CSSProperties = {
  color: '#3f3f46',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '0 0 16px',
};

const buttonSection: React.CSSProperties = {
  margin: '32px 0',
  textAlign: 'center',
};

const button: React.CSSProperties = {
  backgroundColor: '#6741FF',
  borderRadius: '100px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '15px',
  fontWeight: '700',
  letterSpacing: '1px',
  padding: '14px 32px',
  textDecoration: 'none',
  textTransform: 'uppercase',
};

const expiry: React.CSSProperties = {
  color: '#71717a',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0 0 24px',
};

const fallback: React.CSSProperties = {
  color: '#a1a1aa',
  fontSize: '13px',
  lineHeight: '20px',
  margin: '0',
  wordBreak: 'break-all',
};

const fallbackLink: React.CSSProperties = {
  color: '#6741FF',
  textDecoration: 'underline',
};
