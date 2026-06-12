import { Hono } from 'hono';

import { db } from '@CeolX/db';

import {
  renderNotFoundPage,
  renderSharePage,
  SHARE_CSP,
  SHARE_ORIGIN,
  storeUrls,
  UUID_RE,
} from './share-page.js';

/**
 * Web fallback for a shared post link, `GET /post/:id`.
 *
 * The native Share sheet hands out `https://ceolx.ie/post/<id>`
 * (apps/native/hooks/use-share-post.ts). When the app is installed the OS opens
 * it directly via Universal Links / App Links (apps/server/src/routes/app-links.ts)
 * and this page is never seen. This route loads when the app is NOT installed —
 * or the link is opened in a desktop browser / in-app webview — and emits
 * per-post Open Graph tags plus an "Open in app" + store-button landing page.
 *
 * `ceolx.ie` is the admin Vite app; its vercel.json rewrites `/post/*` here so
 * the page is server-rendered (the SPA can't emit per-post meta tags).
 */

interface SharePost {
  mediaType: 'image' | 'video' | 'audio' | 'text';
  mediaUrl: string | null;
  muxPlaybackId: string | null;
}

/**
 * The image used for og:image and the on-page preview. Video posts use the Mux
 * thumbnail (sized to the 1.91:1 OG ratio); image posts use their CDN url.
 * Audio / text posts have no image — the link still unfurls with title + caption.
 */
export function derivePostOgImage(post: SharePost): string | null {
  if (post.mediaType === 'video' && post.muxPlaybackId) {
    return `https://image.mux.com/${post.muxPlaybackId}/thumbnail.jpg?width=1200&height=630&fit_mode=pad`;
  }
  if (post.mediaType === 'image' && post.mediaUrl) {
    return post.mediaUrl;
  }
  return null;
}

const postShare = new Hono();

postShare.get('/post/:id', async (c) => {
  const id = c.req.param('id');
  const { iosStoreUrl, androidStoreUrl } = storeUrls();

  c.header('Content-Security-Policy', SHARE_CSP);

  if (!UUID_RE.test(id)) {
    c.header('Cache-Control', 'no-store');
    return c.html(renderNotFoundPage({ noun: 'post', iosStoreUrl, androidStoreUrl }), 404);
  }

  const post = await db.query.posts.findFirst({
    where: (p, { eq }) => eq(p.id, id),
    with: { author: true },
  });

  if (!post || post.deletedAt) {
    c.header('Cache-Control', 'no-store');
    return c.html(renderNotFoundPage({ noun: 'post', iosStoreUrl, androidStoreUrl }), 404);
  }

  // user.name is the account name. hydrateAuthors() resolves persona display
  // names, but pulling that whole helper into this static page isn't worth the
  // coupling — the caption carries the substance.
  const authorName = post.author?.name ?? 'CeolX';
  const caption = post.caption.trim();
  const description = caption.length > 200 ? `${caption.slice(0, 197)}…` : caption;

  // OG crawlers re-fetch; a 5-minute CDN cache spares the DB without making a
  // deleted post linger long.
  c.header('Cache-Control', 'public, max-age=300, s-maxage=300');
  return c.html(
    renderSharePage({
      title: `${authorName} on CeolX`,
      description: description || `${authorName} shared a post on CeolX`,
      ogImage: derivePostOgImage(post),
      ogType: 'article',
      url: `${SHARE_ORIGIN}/post/${post.id}`,
      deepLink: `ceolx://post/${post.id}`,
      iosStoreUrl,
      androidStoreUrl,
    })
  );
});

export default postShare;
