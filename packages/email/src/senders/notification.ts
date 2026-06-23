import { sendEmail } from '../send.js';

interface NotificationParams {
  to: string;
  subject: string;
  body: string;
  ctaUrl: string;
  userName?: string;
}

/**
 * Dispatch the generic notification template. Fired by the server's
 * notification dispatcher for any trigger whose EMAIL SurfaceCopy is populated
 * (booking lifecycle — matrix A-09..V-13). `subject`/`body` are already
 * interpolated from the trigger copy; `ctaUrl` is the deep-link bridge URL.
 */
export async function sendNotificationEmail({
  to,
  subject,
  body,
  ctaUrl,
  userName = '',
}: NotificationParams): Promise<void> {
  await sendEmail({
    to,
    template: 'notification',
    data: { userName, subject, body, ctaUrl },
  });
}
