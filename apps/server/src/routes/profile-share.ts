import { eq } from 'drizzle-orm';
import { Hono } from 'hono';

import { onHoldVenueIds } from '@CeolX/api/services/venue-gate';
import { db } from '@CeolX/db';
import { user } from '@CeolX/db/schema/auth';
import { artistProfiles, venueProfiles } from '@CeolX/db/schema/users';
import { usernameSchema } from '@CeolX/shared/validators';

import {
  maybeStoreRedirect,
  renderNotFoundPage,
  renderSharePage,
  SHARE_CSP,
  SHARE_ORIGIN,
  storeUrls,
} from './share-page.js';

/**
 * Web fallback for a shared profile link, `GET /u/:username`.
 *
 * Mirrors event-share / post-share. The native Share sheet hands out
 * `https://ceolx.com/u/<username>` (apps/native/hooks/use-share-profile.ts).
 * App installed → the OS deep-links via Universal / App Links and this page is
 * never seen. App absent / desktop / in-app webview → this page unfurls the
 * artist/venue (image + name + bio) and offers "Open in app" + store buttons.
 *
 * Only publicly-visible profiles unfurl. The viewer here is always anonymous
 * (no auth on the unfurl), so the rule is the non-owner branch of
 * isProfileVisibleToViewer (packages/api): artist → is_active; venue → always
 * (subscription gate disabled, Asana 1215489113550392). Missing, spectator,
 * inactive-artist, and malformed handles all render the generic not-found card,
 * so we never leak a hidden profile.
 */

const profileShare = new Hono();

profileShare.get('/u/:username', async (c) => {
  const { iosStoreUrl, androidStoreUrl } = storeUrls();

  const storeRedirect = maybeStoreRedirect(c, { iosStoreUrl, androidStoreUrl });
  if (storeRedirect) return storeRedirect;

  c.header('Content-Security-Policy', SHARE_CSP);

  const notFound = () => {
    c.header('Cache-Control', 'no-store');
    return c.html(renderNotFoundPage({ noun: 'profile', iosStoreUrl, androidStoreUrl }), 404);
  };

  // Handles are stored lowercase. Normalize, then reject anything that isn't a
  // valid handle before hitting the DB (a reserved word can't be registered, so
  // it also falls through to not-found).
  const handle = c.req.param('username').trim().toLowerCase();
  if (!usernameSchema.safeParse(handle).success) return notFound();

  const [account] = await db
    .select({ id: user.id, currentRole: user.currentRole })
    .from(user)
    .where(eq(user.username, handle))
    .limit(1);

  if (!account) return notFound();

  let displayName: string;
  let bio: string | null;
  let image: string | null;
  let deepLinkPath: string;

  if (account.currentRole === 'artist') {
    const [profile] = await db
      .select({
        userId: artistProfiles.userId,
        displayName: artistProfiles.stageName,
        bio: artistProfiles.bio,
        image: artistProfiles.profileImageUrl,
        isActive: artistProfiles.isActive,
      })
      .from(artistProfiles)
      .where(eq(artistProfiles.userId, account.id))
      .limit(1);

    // Anonymous viewer: an artist is public only while active.
    if (!profile || profile.isActive !== true) return notFound();

    displayName = profile.displayName;
    bio = profile.bio;
    image = profile.image;
    deepLinkPath = `artist/${profile.userId}`;
  } else if (account.currentRole === 'venue') {
    const [profile] = await db
      .select({
        userId: venueProfiles.userId,
        displayName: venueProfiles.venueName,
        bio: venueProfiles.bio,
        image: venueProfiles.profileImageUrl,
        id: venueProfiles.id,
        subscriptionStatus: venueProfiles.subscriptionStatus,
      })
      .from(venueProfiles)
      .where(eq(venueProfiles.userId, account.id))
      .limit(1);

    if (!profile) return notFound();

    // V-02: an on-hold venue is NOT a 404 here. This page is what someone sees when
    // they follow a shared link, and a not-found page reads as CeolX losing the
    // venue — exactly the impression D-52 exists to prevent. The venue's own content
    // is withheld and the page says the profile is on hold instead.
    const onHold = await onHoldVenueIds([profile.id]);
    const venueOnHold = onHold.has(profile.id);

    displayName = profile.displayName;
    bio = venueOnHold ? 'This profile is currently on hold.' : profile.bio;
    image = venueOnHold ? null : profile.image;
    deepLinkPath = `venue/${profile.userId}`;
  } else {
    // spectator / admin have no shareable public profile
    return notFound();
  }

  const label = account.currentRole === 'artist' ? 'Artist' : 'Venue';
  const raw = bio?.trim() ? bio.trim() : `${label} on CeolX`;
  const description = raw.length > 200 ? `${raw.slice(0, 197)}…` : raw;

  c.header('Cache-Control', 'public, max-age=300, s-maxage=300');
  return c.html(
    renderSharePage({
      title: displayName,
      description,
      ogImage: image ?? null,
      ogType: 'profile',
      url: `${SHARE_ORIGIN}/u/${handle}`,
      deepLink: `ceolx://${deepLinkPath}`,
      iosStoreUrl,
      androidStoreUrl,
    })
  );
});

export default profileShare;
