import { Hono } from 'hono';

import { db } from '@CeolX/db';
import { env } from '@CeolX/env/server';

/**
 * Web fallback for a shared post link, `GET /post/:id`.
 *
 * The native Share sheet hands out `https://ceolx.ie/post/<id>`
 * (apps/native/hooks/use-share-post.ts). When the app is installed the OS
 * opens it directly via Universal Links / App Links (verified by the files in
 * app-links.ts) and this page is never seen. This route is what loads when the
 * app is NOT installed — or the link is opened in a desktop browser or an
 * in-app webview that suppresses universal links — and does two jobs:
 *
 *  1. Emits per-post Open Graph / Twitter tags so the link unfurls with the
 *     post's image + caption in WhatsApp / iMessage / social.
 *  2. Renders a landing page with an "Open in app" deep link plus App Store /
 *     Play Store buttons, turning a non-user into a download.
 *
 * `ceolx.ie` is the admin Vite app; its vercel.json rewrites `/post/*` here so
 * the page is server-rendered (the SPA can't emit per-post meta tags).
 *
 * Deliberately NO auto-redirect into `ceolx://` (unlike the email deep-link
 * bridge): most hits here are people WITHOUT the app, and a top-level custom-
 * scheme navigation on iOS Safari throws a visible "address invalid" error when
 * the app is absent. The OS handles the installed case before this page loads;
 * the manual button covers in-app-browser stragglers without harming everyone
 * else.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Canonical origin for og:url + the on-page link. Prod default; the staging
// server sets PUBLIC_WEB_ORIGIN to its own Vercel URL (where it serves /post).
const SHARE_ORIGIN = env.PUBLIC_WEB_ORIGIN ?? 'https://ceolx.ie';
const DEFAULT_PLAY_STORE = 'https://play.google.com/store/apps/details?id=ie.ceolx.app';
// Until the app is published the numeric App Store id is unknown, so fall back
// to an App Store search. Replace via IOS_APP_STORE_URL once live.
const DEFAULT_APP_STORE = 'https://apps.apple.com/search?term=ceolx';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface SharePost {
  mediaType: 'image' | 'video' | 'audio' | 'text';
  mediaUrl: string | null;
  muxPlaybackId: string | null;
}

/**
 * The image used for og:image and the on-page preview. Video posts use the Mux
 * thumbnail (same source as the native poster, sized to the 1.91:1 OG ratio);
 * image posts use their CDN url. Audio / text posts have no image — the link
 * still unfurls with title + caption.
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

interface RenderArgs {
  id: string;
  title: string;
  description: string;
  ogImage: string | null;
  iosStoreUrl: string;
  androidStoreUrl: string;
}

export function renderPostSharePage(args: RenderArgs): string {
  const deepLink = `ceolx://post/${args.id}`;
  const url = `${SHARE_ORIGIN}/post/${args.id}`;
  const title = escapeHtml(args.title);
  const description = escapeHtml(args.description);
  const ios = escapeHtml(args.iosStoreUrl);
  const android = escapeHtml(args.androidStoreUrl);
  const deep = escapeHtml(deepLink);

  const ogImageTags = args.ogImage
    ? `<meta property="og:image" content="${escapeHtml(args.ogImage)}">
  <meta name="twitter:card" content="summary_large_image">`
    : `<meta name="twitter:card" content="summary">`;

  const preview = args.ogImage
    ? `<img class="preview" src="${escapeHtml(args.ogImage)}" alt="">`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
  <meta name="description" content="${description}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="CeolX">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:url" content="${escapeHtml(url)}">
  ${ogImageTags}
  <style>
    body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
           background:#080808; color:#fff; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; }
    .card { max-width:380px; padding:32px 24px; text-align:center; }
    .preview { width:100%; border-radius:16px; margin-bottom:20px; display:block; }
    h1 { font-size:20px; margin:0 0 8px; }
    p { font-size:15px; line-height:1.5; opacity:.75; margin:0 0 24px; }
    a.btn { display:block; background:#C8FF2F; color:#080808; text-decoration:none;
            padding:14px 24px; border-radius:999px; font-weight:700; margin:0 0 12px; }
    .stores { display:flex; gap:12px; justify-content:center; }
    a.store { flex:1; border:1px solid rgba(255,255,255,.2); color:#fff; text-decoration:none;
              padding:12px; border-radius:12px; font-size:13px; font-weight:600; }
  </style>
</head>
<body>
  <div class="card">
    ${preview}
    <h1>${title}</h1>
    <p>${description}</p>
    <a class="btn" href="${deep}">Open in the CeolX app</a>
    <div class="stores">
      <a class="store" href="${ios}">App Store</a>
      <a class="store" href="${android}">Google Play</a>
    </div>
  </div>
</body>
</html>`;
}

function renderNotFoundPage(iosStoreUrl: string, androidStoreUrl: string): string {
  return renderPostSharePage({
    id: '',
    title: 'CeolX — Irish music, near you',
    description:
      'This post is no longer available. Get the CeolX app to discover Irish music events.',
    ogImage: null,
    iosStoreUrl,
    androidStoreUrl,
  });
}

const postShare = new Hono();

postShare.get('/post/:id', async (c) => {
  const id = c.req.param('id');

  const iosStoreUrl = env.IOS_APP_STORE_URL ?? DEFAULT_APP_STORE;
  const androidStoreUrl = env.ANDROID_PLAY_STORE_URL ?? DEFAULT_PLAY_STORE;

  // Locks down the rendered page: only same-origin nothing, inline styles, and
  // https images (the Mux/CloudFront preview). No scripts — the page is static
  // HTML, so a stray injected <script> can never execute.
  c.header(
    'Content-Security-Policy',
    "default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"
  );

  if (!UUID_RE.test(id)) {
    c.header('Cache-Control', 'no-store');
    return c.html(renderNotFoundPage(iosStoreUrl, androidStoreUrl), 404);
  }

  const post = await db.query.posts.findFirst({
    where: (p, { eq }) => eq(p.id, id),
    with: { author: true },
  });

  if (!post || post.deletedAt) {
    c.header('Cache-Control', 'no-store');
    return c.html(renderNotFoundPage(iosStoreUrl, androidStoreUrl), 404);
  }

  // user.name is the account name. hydrateAuthors() resolves persona display
  // names (stage name / venue), but pulling that whole helper into this static
  // page isn't worth the coupling — the caption carries the substance.
  const authorName = post.author?.name ?? 'CeolX';
  const caption = post.caption.trim();
  const description = caption.length > 200 ? `${caption.slice(0, 197)}…` : caption;

  // OG crawlers re-fetch; a 5-minute CDN cache spares the DB without making a
  // deleted post linger long.
  c.header('Cache-Control', 'public, max-age=300, s-maxage=300');
  return c.html(
    renderPostSharePage({
      id: post.id,
      title: `${authorName} on CeolX`,
      description: description || `${authorName} shared a post on CeolX`,
      ogImage: derivePostOgImage(post),
      iosStoreUrl,
      androidStoreUrl,
    })
  );
});

export default postShare;
