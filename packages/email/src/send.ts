import { getTransport } from './client.js';
import { SENDER_EMAIL, SENDER_NAME } from './constants.js';
import { renderEmail } from './render.js';
import type { EmailTemplate, SendEmailOptions } from './types.js';

export async function sendEmail<T extends EmailTemplate>({
  to,
  template,
  data,
}: SendEmailOptions<T>): Promise<void> {
  const { html, text, subject } = await renderEmail(template, data);
  const transport = getTransport();
  try {
    await transport.send({
      from: `${SENDER_NAME} <${SENDER_EMAIL}>`,
      to,
      subject,
      html,
      text,
    });
    console.warn('[email] sent', { template, to });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[email] failed', { template, to, error: message });
    throw error;
  }
}
