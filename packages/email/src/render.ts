/** @jsxImportSource react */
import { render } from '@react-email/components';
import * as React from 'react';

import { VerificationEmail } from './templates/verification.js';
import type { EmailTemplate, EmailTemplateMap } from './types.js';

const SUBJECTS: Record<EmailTemplate, string> = {
  verification: 'Verify your CeolX account',
  'password-reset': 'Reset your CeolX password',
};

export async function renderEmail<T extends EmailTemplate>(
  template: T,
  data: EmailTemplateMap[T]
): Promise<{ html: string; text: string; subject: string }> {
  const element = createTemplateElement(template, data);
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);
  return { html, text, subject: SUBJECTS[template] };
}

function createTemplateElement(
  template: EmailTemplate,
  data: EmailTemplateMap[EmailTemplate]
): React.ReactElement {
  switch (template) {
    case 'verification': {
      const d = data as EmailTemplateMap['verification'];
      return React.createElement(VerificationEmail, d);
    }
    case 'password-reset': {
      // TODO: create PasswordResetEmail template (M2-T2)
      const d = data as EmailTemplateMap['password-reset'];
      return React.createElement(VerificationEmail, {
        userName: d.userName,
        verificationUrl: d.resetUrl,
      });
    }
    default: {
      const _exhaustive: never = template;
      throw new Error(`Unknown email template: ${String(_exhaustive)}`);
    }
  }
}
