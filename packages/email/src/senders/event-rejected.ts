import { sendEmail } from '../send.js';

interface EventRejectedParams {
  to: string;
  eventTitle: string;
  reason: string;
  editUrl: string;
  userName?: string;
}

/**
 * Dispatch the event-rejected fallback template. Fires from the admin
 * takedown handler when an event is removed and the primary push
 * notification fails. The reason is mandatory — R7.2 requires the creator
 * see why their event was removed. Scaffold-only in V1 — caller wired in
 * M4-T3 / M9-T2.
 */
export async function sendEventRejectedEmail({
  to,
  eventTitle,
  reason,
  editUrl,
  userName = '',
}: EventRejectedParams): Promise<void> {
  await sendEmail({
    to,
    template: 'event-rejected',
    data: { userName, eventTitle, reason, editUrl },
  });
}
