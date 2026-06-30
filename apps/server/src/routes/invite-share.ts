import { Hono } from 'hono';

import { db } from '@CeolX/db';

import {
  renderNotFoundPage,
  renderSharePage,
  SHARE_CSP,
  SHARE_ORIGIN,
  storeUrls,
} from './share-page.js';

/**
 * Public landing for an outside-platform collaborator invite (matrix A-14),
 * `GET /invite/:token`. The invite email links here; `ceolx.ie` rewrites it to
 * the server. The invitee has no app yet, so the page unfurls the event +
 * inviting venue and offers store buttons + a sign-up deep link. They claim
 * their pending spot by signing up with the SAME email the invite was sent to
 * (see onboarding.createArtistProfile) — the token isn't carried into signup.
 *
 * Expired / unknown tokens and non-active events render the generic not-found
 * card so a stale or taken-down invite is never unfurled.
 */
function formatShareDate(date: Date): string {
  return date.toLocaleDateString('en-IE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/Dublin',
  });
}

const inviteShare = new Hono();

inviteShare.get('/invite/:token', async (c) => {
  const token = c.req.param('token');
  const { iosStoreUrl, androidStoreUrl } = storeUrls();

  c.header('Content-Security-Policy', SHARE_CSP);

  const notFound = () => {
    c.header('Cache-Control', 'no-store');
    return c.html(renderNotFoundPage({ noun: 'invite', iosStoreUrl, androidStoreUrl }), 404);
  };

  if (!token) return notFound();

  const collaborator = await db.query.eventCollaborators.findFirst({
    where: (col, { eq }) => eq(col.inviteToken, token),
  });

  // Unknown token, already claimed, or past its 14-day expiry → not-found.
  if (
    !collaborator ||
    collaborator.artistProfileId !== null ||
    !collaborator.inviteTokenExpiresAt ||
    collaborator.inviteTokenExpiresAt.getTime() < Date.now()
  ) {
    return notFound();
  }

  const event = await db.query.events.findFirst({
    where: (e, { eq }) => eq(e.id, collaborator.eventId),
    with: { venue: true },
  });

  // Don't leak removed/archived events.
  if (!event || event.status !== 'active') return notFound();

  const inviter = event.venue?.venueName ?? event.venueAddress ?? 'A CeolX venue';
  const dateLabel = formatShareDate(new Date(event.dateStart));
  const raw = `${inviter} invited you to perform on ${dateLabel}. Join CeolX with this email address to claim your spot.`;
  const description = raw.length > 200 ? `${raw.slice(0, 197)}…` : raw;

  c.header('Cache-Control', 'no-store');
  return c.html(
    renderSharePage({
      title: `You're invited to perform at "${event.title}"`,
      description,
      ogImage: event.coverImage ?? null,
      ogType: 'website',
      url: `${SHARE_ORIGIN}/invite/${token}`,
      deepLink: 'ceolx://sign-up?role=artist',
      iosStoreUrl,
      androidStoreUrl,
    })
  );
});

export default inviteShare;
