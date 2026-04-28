import { eq, sql } from 'drizzle-orm';

import { db } from '@CeolX/db';
import { events, eventViews } from '@CeolX/db/schema/events';

export interface RecordEventViewParams {
  eventId: string;
  viewerUserId: string | null;
  eventCreatorId: string;
}

// Best-effort view tracking. Skips anonymous viewers and the creator.
// Failures are swallowed so tracking can never break event detail loads.
export async function recordEventView({
  eventId,
  viewerUserId,
  eventCreatorId,
}: RecordEventViewParams): Promise<void> {
  if (!viewerUserId || viewerUserId === eventCreatorId) return;

  try {
    await Promise.all([
      db
        .update(events)
        .set({ viewCount: sql`${events.viewCount} + 1` })
        .where(eq(events.id, eventId)),
      db.insert(eventViews).values({
        eventId,
        userId: viewerUserId,
      }),
    ]);
  } catch {
    // tracking failures must not break event detail loads
  }
}
