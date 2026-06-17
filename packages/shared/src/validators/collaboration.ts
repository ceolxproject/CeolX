import { z } from 'zod';

// Share Interest — an artist or venue signals collaboration interest in the
// profile owner identified by `recipientUserId`. The sender is the session
// user; direction is resolved server-side from both parties' personas.
export const shareInterestSchema = z.object({
  recipientUserId: z.string().min(1, 'recipientUserId is required'),
});

export type ShareInterestInput = z.infer<typeof shareInterestSchema>;
