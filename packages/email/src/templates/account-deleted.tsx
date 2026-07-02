/** @jsxRuntime automatic @jsxImportSource react */
import { Text } from '@react-email/components';

import { EmailLayout } from './components/email-layout.js';
import { bodyText, heading, mutedText } from './components/email-styles.js';

interface AccountDeletedEmailProps {
  userName: string;
}

export function AccountDeletedEmail({ userName }: AccountDeletedEmailProps) {
  return (
    <EmailLayout preview="Your CeolX account has been deleted">
      <Text style={heading}>Your CeolX account has been deleted</Text>

      <Text style={bodyText}>Hi {userName || 'there'},</Text>

      <Text style={bodyText}>
        Your CeolX account and personal data have been permanently deleted, as you requested. This
        action is final and cannot be undone.
      </Text>

      <Text style={mutedText}>
        If you didn&apos;t request this, contact us at admin@ceolx.com straight away.
      </Text>
    </EmailLayout>
  );
}
