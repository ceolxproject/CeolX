import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import { db } from '@CeolX/db';
import { venueProfiles } from '@CeolX/db/schema/users';
import { UserRole as UserRoleEnum, VENUE_PUBLISH_BLOCKED_MESSAGE } from '@CeolX/shared';

import { onHoldVenueIds } from '../services/venue-gate';

/**
 * Refuse publishing for a venue whose subscription is on hold (M8-T0 V-14).
 *
 * Creating public content is part of the paid service, and Sean was explicit that
 * an unpaid venue is blocked from it. Enforced server-side because the disabled
 * button in the app is presentation, not access control — a direct tRPC call would
 * otherwise sail straight past it.
 *
 * A venue inside the 7-day grace window can still publish: they are still visible
 * and still a paying customer whose card merely expired (D-33). Only a genuinely
 * hidden venue is blocked, which is what `onHoldVenueIds` already encodes.
 *
 * No-ops for artists — they are free (D-01) and have no billing state to gate on.
 */
export async function assertVenueMayPublish(
  userId: string,
  currentRole: string | null | undefined
): Promise<void> {
  if (currentRole !== UserRoleEnum.VENUE) return;

  const [profile] = await db
    .select({ id: venueProfiles.id })
    .from(venueProfiles)
    .where(eq(venueProfiles.userId, userId))
    .limit(1);

  if (!profile) return;

  const onHold = await onHoldVenueIds([profile.id]);
  if (onHold.has(profile.id)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: VENUE_PUBLISH_BLOCKED_MESSAGE,
    });
  }
}
