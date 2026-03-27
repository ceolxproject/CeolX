import { getTransport } from './client.js';
import { SENDER_EMAIL, SENDER_NAME } from './constants.js';
import type { SendEmailOptions } from './types.js';

export async function sendEmail({
  to,
  subject,
  htmlBody,
  textBody,
  tag,
}: SendEmailOptions): Promise<void> {
  const transport = getTransport();
  try {
    await transport.send({
      from: `${SENDER_NAME} <${SENDER_EMAIL}>`,
      to,
      subject,
      html: htmlBody,
      text: textBody,
    });
    console.warn('[email] sent', { tag, to });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[email] failed', { tag, to, error: message });
    throw error;
  }
}
