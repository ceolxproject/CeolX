/** @jsxImportSource react */
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

interface PaymentConfirmationEmailProps {
  userName: string;
  amount: string;
  planName: string;
  nextBillingDate: string;
  manageUrl: string;
  invoiceUrl?: string;
}

export function PaymentConfirmationEmail({
  userName,
  amount,
  planName,
  nextBillingDate,
  manageUrl,
  invoiceUrl,
}: PaymentConfirmationEmailProps) {
  return (
    <EmailLayout preview={`Payment received for ${planName} — receipt inside`}>
      <Text style={heading}>Payment received</Text>

      <Text style={bodyText}>Hi {userName || 'there'},</Text>

      <Text style={bodyText}>
        We received your payment of <strong>{amount}</strong> for <strong>{planName}</strong>.
      </Text>

      <Text style={bodyText}>
        Next renewal: <strong>{nextBillingDate}</strong>
      </Text>

      <Section style={buttonSection}>
        <Button href={manageUrl} style={primaryButton}>
          Manage subscription
        </Button>
      </Section>

      {invoiceUrl ? (
        <Text style={mutedText}>
          Need a copy of the invoice?{' '}
          <a href={invoiceUrl} style={inlineLink}>
            Download it here
          </a>
          .
        </Text>
      ) : null}

      <Text style={fallbackText}>
        Manage billing at{' '}
        <a href={manageUrl} style={inlineLink}>
          {manageUrl}
        </a>
      </Text>
    </EmailLayout>
  );
}
