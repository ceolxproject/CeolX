import { Hono } from 'hono';

import { db } from '@CeolX/db';

import {
  renderNotFoundPage,
  renderSharePage,
  SHARE_CSP,
  SHARE_ORIGIN,
  storeRedirectFor,
  storeUrls,
  UUID_RE,
} from './share-page.js';

/**
 * Web fallback for a shared event link, `GET /event/:id`.
 *
 * Mirrors post-share (apps/server/src/routes/post-share.ts). The native Share
 * sheet hands out `https://ceolx.com/event/<id>`
 * (apps/native/hooks/use-share-event.ts). App installed → the OS deep-links via
 * Universal / App Links and this page is never seen. App absent / desktop /
 * in-app webview → this page unfurls the event (cover + title + date + venue)
 * and offers "Open in app" + store buttons.
 *
 * Only `status = 'active'` events unfurl. Removed (admin takedown), archived
 * (past), missing, and non-UUID ids all render the generic not-found card so we
 * never leak a taken-down or expired event publicly.
 */

/** "Sat, 15 Jul 2026" in Irish locale + timezone — matches the in-app date row. */
function formatShareDate(date: Date): string {
  return date.toLocaleDateString('en-IE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/Dublin',
  });
}

const eventShare = new Hono();

eventShare.get('/event/:id', async (c) => {
  const id = c.req.param('id');
  const { iosStoreUrl, androidStoreUrl } = storeUrls();

  // App absent → OS opened this in a browser. Redirect real mobile browsers to
  // the store; no-store keeps that redirect out of shared caches so a crawler
  // can't be served it and lose the unfurl.
  c.header('Vary', 'User-Agent');
  const storeRedirect = storeRedirectFor(c.req.header('user-agent'), {
    iosStoreUrl,
    androidStoreUrl,
  });
  if (storeRedirect) {
    c.header('Cache-Control', 'no-store');
    return c.redirect(storeRedirect, 302);
  }

  c.header('Content-Security-Policy', SHARE_CSP);

  if (!UUID_RE.test(id)) {
    c.header('Cache-Control', 'no-store');
    return c.html(renderNotFoundPage({ noun: 'event', iosStoreUrl, androidStoreUrl }), 404);
  }

  const event = await db.query.events.findFirst({
    where: (e, { eq }) => eq(e.id, id),
    with: { venue: true },
  });

  // Only active events are public. Anything else → not-found (no-store).
  if (!event || event.status !== 'active') {
    c.header('Cache-Control', 'no-store');
    return c.html(renderNotFoundPage({ noun: 'event', iosStoreUrl, androidStoreUrl }), 404);
  }

  const dateLabel = formatShareDate(new Date(event.dateStart));
  const place = event.venue?.venueName ?? event.venueAddress ?? 'CeolX';
  const raw = `${dateLabel} · ${place}`;
  const description = raw.length > 200 ? `${raw.slice(0, 197)}…` : raw;

  c.header('Cache-Control', 'public, max-age=300, s-maxage=300');
  return c.html(
    renderSharePage({
      title: event.title,
      description,
      ogImage: event.coverImage ?? null,
      ogType: 'website',
      url: `${SHARE_ORIGIN}/event/${event.id}`,
      deepLink: `ceolx://event/${event.id}`,
      iosStoreUrl,
      androidStoreUrl,
    })
  );
});

export default eventShare;
