import { env } from '@CeolX/env/server';

/** Matches a canonical lowercase/uppercase UUID. Shared by every share route. */
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Canonical origin for og:url + on-page links. Prod default; the staging server
// sets PUBLIC_WEB_ORIGIN to its own Vercel URL (where it serves /post + /event).
export const SHARE_ORIGIN = env.PUBLIC_WEB_ORIGIN ?? 'https://ceolx.ie';

// Until the app is published the numeric App Store id is unknown, so fall back
// to an App Store search. Replace via IOS_APP_STORE_URL once live.
const DEFAULT_APP_STORE = 'https://apps.apple.com/search?term=ceolx';
const DEFAULT_PLAY_STORE = 'https://play.google.com/store/apps/details?id=ie.ceolx.app';

/** Resolves the store-button urls, honouring per-deploy env overrides. */
export function storeUrls(): { iosStoreUrl: string; androidStoreUrl: string } {
  return {
    iosStoreUrl: env.IOS_APP_STORE_URL ?? DEFAULT_APP_STORE,
    androidStoreUrl: env.ANDROID_PLAY_STORE_URL ?? DEFAULT_PLAY_STORE,
  };
}

// Locks down the rendered page: no scripts, only inline styles + https/data
// images (the Mux/CloudFront preview). A stray injected tag can never execute.
export const SHARE_CSP =
  "default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'";

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface RenderShareArgs {
  title: string;
  description: string;
  ogImage: string | null;
  /** og:type — 'article' for posts, 'website' for events. Defaults to 'website'. */
  ogType?: string;
  /** Canonical https url for og:url. */
  url: string;
  /** ceolx://… custom-scheme link behind the "Open in app" button. */
  deepLink: string;
  iosStoreUrl: string;
  androidStoreUrl: string;
}

/**
 * Renders the static share / download landing page shared by every shareable
 * entity (posts, events). No scripts — pairs with SHARE_CSP. Deliberately NO
 * auto-redirect into the deep link: most hits here are people WITHOUT the app,
 * and a top-level custom-scheme navigation on iOS Safari throws a visible error
 * when the app is absent. The OS handles the installed case via Universal /
 * App Links before this page ever loads; the manual button covers stragglers.
 */
export function renderSharePage(args: RenderShareArgs): string {
  const title = escapeHtml(args.title);
  const description = escapeHtml(args.description);
  const ios = escapeHtml(args.iosStoreUrl);
  const android = escapeHtml(args.androidStoreUrl);
  const deep = escapeHtml(args.deepLink);
  const ogType = escapeHtml(args.ogType ?? 'website');

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
  <meta property="og:type" content="${ogType}">
  <meta property="og:site_name" content="CeolX">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:url" content="${escapeHtml(args.url)}">
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

/** Generic "this <noun> is gone — get the app" page used by every share route. */
export function renderNotFoundPage(args: {
  noun: string;
  iosStoreUrl: string;
  androidStoreUrl: string;
}): string {
  return renderSharePage({
    title: 'CeolX — Irish music, near you',
    description: `This ${args.noun} is no longer available. Get the CeolX app to discover Irish music events.`,
    ogImage: null,
    url: SHARE_ORIGIN,
    deepLink: 'ceolx://',
    iosStoreUrl: args.iosStoreUrl,
    androidStoreUrl: args.androidStoreUrl,
  });
}
