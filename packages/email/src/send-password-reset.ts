import { sendEmail } from './send.js';

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  await sendEmail({
    to,
    subject: 'Reset your CeolX password',
    htmlBody: `
      <p>You requested a password reset for your CeolX account.</p>
      <p>Tap the link below to set a new password. This link expires in 15 minutes.</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p><strong>Do not share this link with anyone.</strong></p>
      <p>If you did not request a password reset, you can safely ignore this email.</p>
    `,
    textBody: [
      'You requested a password reset for your CeolX account.',
      '',
      'Tap the link below to set a new password. This link expires in 15 minutes.',
      '',
      resetUrl,
      '',
      'Do not share this link with anyone.',
      '',
      'If you did not request a password reset, you can safely ignore this email.',
    ].join('\n'),
    tag: 'password-reset',
  });
}
