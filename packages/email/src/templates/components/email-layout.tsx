/** @jsxRuntime automatic @jsxImportSource react */
import { Body, Container, Head, Hr, Html, Preview, Section, Text } from '@react-email/components';
import * as React from 'react';

import { SUPPORT_EMAIL } from '../../constants.js';

interface EmailLayoutProps {
  preview: string;
  children: React.ReactNode;
}

export function EmailLayout({ preview, children }: EmailLayoutProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Text style={logo}>CEOLX</Text>
          </Section>

          {/* Content */}
          <Section style={content}>{children}</Section>

          {/* Footer */}
          <Hr style={divider} />
          <Section style={footer}>
            <Text style={footerText}>
              © {new Date().getFullYear()} CeolX · Chongie Entertainment Services, Ireland
            </Text>
            <Text style={footerText}>
              Questions?{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`} style={footerLink}>
                {SUPPORT_EMAIL}
              </a>
            </Text>
            <Text style={footerDisclaimer}>
              If you did not request this email, you can safely ignore it.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const body: React.CSSProperties = {
  backgroundColor: '#f4f4f5',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  margin: 0,
  padding: '32px 0',
};

const container: React.CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: '12px',
  maxWidth: '560px',
  margin: '0 auto',
  overflow: 'hidden',
};

const header: React.CSSProperties = {
  backgroundColor: '#0d0c0f',
  padding: '24px 40px',
};

const logo: React.CSSProperties = {
  color: '#ffffff',
  fontSize: '20px',
  fontWeight: '800',
  letterSpacing: '4px',
  margin: 0,
};

const content: React.CSSProperties = {
  padding: '40px 40px 32px',
};

const divider: React.CSSProperties = {
  borderColor: '#e4e4e7',
  margin: '0 40px',
};

const footer: React.CSSProperties = {
  padding: '24px 40px 32px',
};

const footerText: React.CSSProperties = {
  color: '#71717a',
  fontSize: '13px',
  lineHeight: '20px',
  margin: '0 0 4px',
};

const footerLink: React.CSSProperties = {
  color: '#6741FF',
  textDecoration: 'none',
};

const footerDisclaimer: React.CSSProperties = {
  color: '#a1a1aa',
  fontSize: '12px',
  marginTop: '12px',
};
