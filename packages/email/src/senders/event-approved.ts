import { sendEmail } from '../send.js';

interface EventApprovedParams {
  to: string;
  eventTitle: string;
  eventUrl: string;
  userName?: string;
  eventDate?: string;
}

/**
 * Dispatch the event-approved fallback template. Fires from the event
 * moderation handler when an event is approved (or resubmitted) and the
 * primary push notification fails. Scaffold-only in V1 — the caller is
 * wired in M4-T3 / M9-T2.
 */
export async function sendEventApprovedEmail({
  to,
  eventTitle,
  eventUrl,
  userName = '',
  eventDate,
}: EventApprovedParams): Promise<void> {
  await sendEmail({
    to,
    template: 'event-approved',
    data: {
      userName,
      eventTitle,
      eventUrl,
      ...(eventDate ? { eventDate } : {}),
    },
  });
}
