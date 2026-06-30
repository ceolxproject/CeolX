import { sendEmail } from '../send.js';

interface CollaboratorInviteParams {
  to: string;
  inviterName: string;
  eventTitle: string;
  inviteUrl: string;
  eventDate?: string;
}

/**
 * Dispatch the outside-platform collaborator invite (matrix A-14). Fired from
 * `bookings.inviteExternal` when a venue invites a non-platform artist.
 */
export async function sendCollaboratorInviteEmail({
  to,
  inviterName,
  eventTitle,
  inviteUrl,
  eventDate,
}: CollaboratorInviteParams): Promise<void> {
  await sendEmail({
    to,
    template: 'collaborator-invite',
    data: {
      inviterName,
      eventTitle,
      inviteUrl,
      ...(eventDate ? { eventDate } : {}),
    },
  });
}
