# Share Button for Events Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Share button to the event detail screen that produces a `https://ceolx.com/event/<id>` link which deep-links into the app when installed and unfurls (cover + title + date + venue) with store buttons when not.

**Architecture:** Structural clone of the existing post-share system across three deploy targets — native app (share hook + header icon + thin deep-link redirect + Android intent filter), Hono server (`GET /event/:id` OG page + widened App Links ownership files), and admin Vercel (`/event/*` rewrite). A shared HTML-shell helper is extracted so the post and event web pages do not duplicate ~60 lines of markup.

**Tech Stack:** TypeScript, React Native + Expo Router, Hono, Drizzle ORM, Vitest, Vercel rewrites, Apple Universal Links / Android App Links.

---

## File Structure

**Server (`apps/server`)**

- Create: `src/routes/share-page.ts` — shared HTML shell + `escapeHtml`, `UUID_RE`, store-url + origin constants, generic not-found page. One responsibility: render the share/download HTML.
- Create: `src/routes/event-share.ts` — `GET /event/:id`: load event, derive OG fields, render via `share-page.ts`.
- Modify: `src/routes/post-share.ts` — re-point onto `share-page.ts` (delete its private copies of `escapeHtml`/`UUID_RE`/markup/constants). Keeps `derivePostOgImage`.
- Modify: `src/routes/app-links.ts` — advertise both `/post/*` and `/event/*`.
- Modify: `src/app.ts` — mount `eventShareRoute`.
- Create: `src/__tests__/routes/event-share.test.ts`.
- Modify: `src/__tests__/routes/app-links.test.ts` — assert both globs.

**Native (`apps/native`)**

- Create: `hooks/use-share-event.ts` — opens the share sheet for an event.
- Create: `app/(app)/event/[eventId].tsx` — thin redirect into the discover detail screen.
- Create: `app/(app)/event/_layout.tsx` — stack wrapper (mirrors `app/(app)/post/_layout.tsx`).
- Modify: `components/event-detail/EventDetailHeader.tsx` — optional `onShare` + share icon.
- Modify: `components/event-detail/EventDetailView.tsx` — wire `useShareEvent` → `onShare` (this is where `EventDetailHeader` is actually rendered; the spec said `EventDetailScreen` but the header lives here).
- Modify: `app.config.js` — add `/event` Android intent-filter `pathPrefix`.
- Modify: `lib/notification-route.ts` — remap singular `/event/:id`.

---

## Task 1: Extract the shared share-page shell

**Files:**

- Create: `apps/server/src/routes/share-page.ts`
- Modify: `apps/server/src/routes/post-share.ts`
- Test (existing, must stay green): `apps/server/src/__tests__/routes/post-share.test.ts`

- [ ] **Step 1: Create the shared shell module**

Create `apps/server/src/routes/share-page.ts`:

```ts
import { env } from '@CeolX/env/server';

/** Matches a canonical lowercase/uppercase UUID. Shared by every share route. */
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Canonical origin for og:url + on-page links. Prod default; the staging server
// sets PUBLIC_WEB_ORIGIN to its own Vercel URL (where it serves /post + /event).
export const SHARE_ORIGIN = env.PUBLIC_WEB_ORIGIN ?? 'https://ceolx.com';

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
```

- [ ] **Step 2: Re-point `post-share.ts` onto the shell**

Replace the contents of `apps/server/src/routes/post-share.ts` with:

```ts
import { Hono } from 'hono';

import { db } from '@CeolX/db';

import {
  escapeHtml,
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
 * The native Share sheet hands out `https://ceolx.com/post/<id>`
 * (apps/native/hooks/use-share-post.ts). When the app is installed the OS opens
 * it directly via Universal Links / App Links (apps/server/src/routes/app-links.ts)
 * and this page is never seen. This route loads when the app is NOT installed —
 * or the link is opened in a desktop browser / in-app webview — and emits
 * per-post Open Graph tags plus an "Open in app" + store-button landing page.
 *
 * `ceolx.com` is the admin Vite app; its vercel.json rewrites `/post/*` here so
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
      description: escapeHtml(description) ? description : `${authorName} shared a post on CeolX`,
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
```

> Note: the `escapeHtml(description) ? description : fallback` keeps the original "empty caption → fallback copy" behaviour without re-escaping (renderSharePage escapes internally). If you prefer, use `description || \`${authorName} shared a post on CeolX\`` — functionally identical for the test.

- [ ] **Step 3: Run the existing post-share + app-links tests to prove the refactor is behaviour-preserving**

Run: `pnpm --filter @CeolX/server test src/__tests__/routes/post-share.test.ts`
Expected: PASS (all cases — the rendered HTML is byte-for-byte the same markup, just sourced from `share-page.ts`).

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/routes/share-page.ts apps/server/src/routes/post-share.ts
git commit -m "♻️ refactor(server): extract shared share-page shell from post-share"
```

---

## Task 2: Event share web fallback route (`GET /event/:id`)

**Files:**

- Create: `apps/server/src/routes/event-share.ts`
- Test: `apps/server/src/__tests__/routes/event-share.test.ts`
- Modify: `apps/server/src/app.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/server/src/__tests__/routes/event-share.test.ts`:

```ts
import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { mockFindFirst } = vi.hoisted(() => ({ mockFindFirst: vi.fn() }));

vi.mock('@CeolX/db', () => ({
  db: { query: { events: { findFirst: mockFindFirst } } },
}));

// Defaults (no store overrides) so the route derives the fallback store urls.
vi.mock('@CeolX/env/server', () => ({
  env: {
    IOS_APP_STORE_URL: undefined,
    ANDROID_PLAY_STORE_URL: undefined,
    PUBLIC_WEB_ORIGIN: undefined,
  },
}));

import eventShareRoute from '../../routes/event-share.js';

function buildApp() {
  const app = new Hono();
  app.route('/', eventShareRoute);
  return app;
}

const VALID_ID = '22222222-2222-4222-8222-222222222222';

function activeEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: VALID_ID,
    title: 'Trad Session at The Cobblestone',
    description: 'A lively night of Irish music',
    coverImage: 'https://cdn.ceolx.com/events/cover.jpg',
    dateStart: new Date('2026-07-15T20:00:00.000Z'),
    venueAddress: '77 King St N, Dublin',
    status: 'active',
    venue: { venueName: 'The Cobblestone' },
    ...overrides,
  };
}

afterEach(() => {
  mockFindFirst.mockReset();
});

describe('GET /event/:id', () => {
  it('renders OG tags, the cover image, a deep link, and store buttons for an active event', async () => {
    mockFindFirst.mockResolvedValue(activeEvent());

    const res = await buildApp().request(`/event/${VALID_ID}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/html/);
    expect(res.headers.get('cache-control')).toMatch(/max-age=300/);

    const html = await res.text();
    expect(html).toContain('<meta property="og:title" content="Trad Session at The Cobblestone">');
    // Description = formatted date · venue name.
    expect(html).toContain('The Cobblestone');
    expect(html).toContain(
      `<meta property="og:url" content="https://ceolx.com/event/${VALID_ID}">`
    );
    expect(html).toContain('https://cdn.ceolx.com/events/cover.jpg');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
    expect(html).toContain(`href="ceolx://event/${VALID_ID}"`);
    expect(html).toContain('play.google.com/store/apps/details?id=ie.ceolx.app');
    expect(html).toContain('apps.apple.com');
  });

  it('falls back to venueAddress when there is no registered venue', async () => {
    mockFindFirst.mockResolvedValue(activeEvent({ venue: null }));
    const html = await (await buildApp().request(`/event/${VALID_ID}`)).text();
    expect(html).toContain('77 King St N, Dublin');
  });

  it('omits og:image and uses the summary card when the event has no cover', async () => {
    mockFindFirst.mockResolvedValue(activeEvent({ coverImage: null }));
    const html = await (await buildApp().request(`/event/${VALID_ID}`)).text();
    expect(html).not.toContain('og:image');
    expect(html).toContain('<meta name="twitter:card" content="summary">');
  });

  it('escapes HTML in the title so an event cannot inject markup', async () => {
    mockFindFirst.mockResolvedValue(activeEvent({ title: '<script>alert(1)</script>' }));
    const html = await (await buildApp().request(`/event/${VALID_ID}`)).text();
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('returns a 404 download page for a malformed id without touching the db', async () => {
    const res = await buildApp().request('/event/not-a-uuid');
    expect(res.status).toBe(404);
    expect(res.headers.get('cache-control')).toMatch(/no-store/);
    expect(mockFindFirst).not.toHaveBeenCalled();
    const html = await res.text();
    expect(html).toContain('apps.apple.com');
    expect(html).toContain('play.google.com');
  });

  it('returns a 404 download page when the event is missing or not active', async () => {
    mockFindFirst.mockResolvedValue(undefined);
    expect((await buildApp().request(`/event/${VALID_ID}`)).status).toBe(404);

    mockFindFirst.mockResolvedValue(activeEvent({ status: 'removed' }));
    expect((await buildApp().request(`/event/${VALID_ID}`)).status).toBe(404);

    mockFindFirst.mockResolvedValue(activeEvent({ status: 'archived' }));
    expect((await buildApp().request(`/event/${VALID_ID}`)).status).toBe(404);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @CeolX/server test src/__tests__/routes/event-share.test.ts`
Expected: FAIL — `Cannot find module '../../routes/event-share.js'`.

- [ ] **Step 3: Implement the route**

Create `apps/server/src/routes/event-share.ts`:

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @CeolX/server test src/__tests__/routes/event-share.test.ts`
Expected: PASS (all 6 cases).

- [ ] **Step 5: Mount the route in `app.ts`**

In `apps/server/src/app.ts`, add the import beside the existing post-share import (after line 20 `import postShareRoute from './routes/post-share';`):

```ts
import eventShareRoute from './routes/event-share';
```

And mount it right after the existing `app.route('/', postShareRoute);` (line 71):

```ts
app.route('/', postShareRoute);
app.route('/', eventShareRoute);
```

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/routes/event-share.ts apps/server/src/__tests__/routes/event-share.test.ts apps/server/src/app.ts
git commit -m "✨ feat(server): add event share web fallback page at get /event/:id"
```

---

## Task 3: Advertise `/event/*` in the App Links ownership files

**Files:**

- Modify: `apps/server/src/routes/app-links.ts`
- Test: `apps/server/src/__tests__/routes/app-links.test.ts`

- [ ] **Step 1: Update the test to expect both globs**

In `apps/server/src/__tests__/routes/app-links.test.ts`, replace the first AASA test (the `'serves valid JSON with the appID built from the Team ID, scoped to /post/*'` case, lines 35–46) with:

```ts
it('serves valid JSON with the appID built from the Team ID, scoped to /post/* and /event/*', async () => {
  mockEnv.APPLE_OAUTH_TEAM_ID = 'ABCDE12345';
  const res = await buildApp().request('/.well-known/apple-app-site-association');

  expect(res.status).toBe(200);
  expect(res.headers.get('content-type')).toMatch(/application\/json/);

  const body = (await res.json()) as Aasa;
  const detail = body.applinks.details[0];
  expect(detail?.appIDs).toEqual(['ABCDE12345.ie.ceolx.app']);
  const paths = detail?.components.map((comp) => comp['/']);
  expect(paths).toEqual(['/post/*', '/event/*']);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @CeolX/server test src/__tests__/routes/app-links.test.ts`
Expected: FAIL — `expected [ '/post/*' ] to deeply equal [ '/post/*', '/event/*' ]`.

- [ ] **Step 3: Widen the path glob in `app-links.ts`**

In `apps/server/src/routes/app-links.ts`, replace the single-glob constant (line 38):

```ts
// Shared-link path scope, kept identical on both platforms.
const LINK_PATH_GLOB = '/post/*';
```

with a list:

```ts
// Shared-link path scopes, kept identical on both platforms. Each shareable web
// route (apps/native/hooks/use-share-*.ts) needs its prefix listed here AND in
// the matching app.config.js intentFilters + admin vercel.json rewrite.
const LINK_PATH_GLOBS = ['/post/*', '/event/*'];
```

Then in the AASA handler, replace the single-component `details` block (lines 49–56) with one component per glob:

```ts
const details = teamId
  ? [
      {
        appIDs: [`${teamId}.${BUNDLE_ID}`],
        components: LINK_PATH_GLOBS.map((glob) => ({
          '/': glob,
          comment: 'Shared CeolX links',
        })),
      },
    ]
  : [];
```

Also update the file header comment that says `Paths are scoped to '/post/*'` (around line 22) to read `Paths are scoped to '/post/*' and '/event/*'`. (`assetlinks.json` is host/relation-level and needs no change.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @CeolX/server test src/__tests__/routes/app-links.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/routes/app-links.ts apps/server/src/__tests__/routes/app-links.test.ts
git commit -m "✨ feat(server): advertise /event/* in app links ownership files"
```

---

## Task 4: Admin Vercel rewrite for `/event/*`

**Files:**

- Modify: `apps/admin/vercel.json`

- [ ] **Step 1: Add the rewrite**

In `apps/admin/vercel.json`, add the `/event/:path*` rewrite immediately after the `/post/:path*` line and before the SPA catch-all, so the `rewrites` array reads:

```json
  "rewrites": [
    { "source": "/.well-known/:path*", "destination": "https://api.ceolx.com/.well-known/:path*" },
    { "source": "/post/:path*", "destination": "https://api.ceolx.com/post/:path*" },
    { "source": "/event/:path*", "destination": "https://api.ceolx.com/event/:path*" },
    { "source": "/(.*)", "destination": "/index.html" }
  ],
```

(Order matters — the `/(.*)` catch-all would otherwise swallow `/event/*` and serve the SPA shell, which can't emit per-event meta tags.)

- [ ] **Step 2: Verify JSON is well-formed**

Run: `node -e "JSON.parse(require('fs').readFileSync('apps/admin/vercel.json','utf8')); console.log('valid')"`
Expected: prints `valid`.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/vercel.json
git commit -m "✨ feat(admin): rewrite /event/* to the event share page on the api"
```

---

## Task 5: Native `useShareEvent` hook

**Files:**

- Create: `apps/native/hooks/use-share-event.ts`

- [ ] **Step 1: Implement the hook**

Create `apps/native/hooks/use-share-event.ts` (clone of `use-share-post.ts`):

```ts
import { useCallback } from 'react';
import { Alert, Share } from 'react-native';

import { env } from '@CeolX/env/native';

// Prod marketing domain by default; staging overrides via env to point at the
// staging server's Vercel URL. Must stay in sync with the associatedDomains /
// intentFilters host in app.config.js and the server's /event route.
const SHARE_BASE_URL = env.EXPO_PUBLIC_SHARE_BASE_URL ?? 'https://ceolx.com';

/**
 * Opens the native Share sheet for an event.
 *
 * The URL points to ceolx.com — on devices with the app installed, iOS
 * Universal Links / Android App Links route the tap back into the app at
 * `/event/<id>` (apps/native/app/(app)/event/[eventId].tsx), which redirects to
 * the discover event detail screen. On devices without the app,
 * ceolx.com/event/<id> rewrites to the server's event-share page
 * (apps/server/src/routes/event-share.ts), which unfurls the event and offers
 * App Store / Play Store buttons.
 */
export function useShareEvent() {
  return useCallback(async (eventId: string, title: string, dateLabel: string) => {
    const url = `${SHARE_BASE_URL}/event/${eventId}`;
    try {
      await Share.share({
        url,
        message: `Check out ${title} on CeolX\n${dateLabel}\n${url}`,
        title: 'Check out this event on CeolX',
      });
    } catch {
      Alert.alert('Unable to share', 'Please try again.');
    }
  }, []);
}
```

- [ ] **Step 2: Typecheck the native package**

Run: `pnpm --filter @CeolX/native exec tsc --noEmit`
Expected: PASS (no new errors). If `env.EXPO_PUBLIC_SHARE_BASE_URL` is reported missing, confirm `use-share-post.ts` references it the same way (it does) — they share the env module.

- [ ] **Step 3: Commit**

```bash
git add apps/native/hooks/use-share-event.ts
git commit -m "✨ feat(native): add use-share-event hook for the event share sheet"
```

---

## Task 6: Share icon in the event detail header

**Files:**

- Modify: `apps/native/components/event-detail/EventDetailHeader.tsx`
- Modify: `apps/native/components/event-detail/EventDetailView.tsx`

- [ ] **Step 1: Add the `onShare` prop + icon to the header**

In `apps/native/components/event-detail/EventDetailHeader.tsx`, add `onShare` to the props interface and render a share icon left of the bookmark. Replace the interface and the right-hand action group:

```tsx
interface EventDetailHeaderProps {
  onBack: () => void;
  isSaved: boolean;
  onToggleSave: () => void;
  onShare: () => void;
  className?: string;
}

export function EventDetailHeader({
  onBack,
  isSaved,
  onToggleSave,
  onShare,
  className,
}: EventDetailHeaderProps) {
  return (
    <View
      className={cn('flex-row items-center justify-between px-5 h-14 bg-background', className)}
    >
      <Pressable onPress={onBack} hitSlop={12} className="active:opacity-70">
        <Ionicons name="arrow-back" size={24} color="#fff" />
      </Pressable>

      <CeolxLogo fontSize={16} letterSpacing={2} />

      <View className="flex-row items-center gap-4">
        <Pressable onPress={onShare} hitSlop={12} className="active:opacity-70">
          <Ionicons name="share-outline" size={23} color="#fff" />
        </Pressable>
        <Pressable onPress={onToggleSave} hitSlop={12} className="active:opacity-70">
          <Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={23} color="#fff" />
        </Pressable>
        <BellWithBadge onPress={() => router.push('/notifications')} size={24} />
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Wire `useShareEvent` in `EventDetailView`**

In `apps/native/components/event-detail/EventDetailView.tsx`:

(a) Add the import beside the other `@/hooks` imports (near line 30 `import { useSaveEvent } from '@/hooks/use-save-event';`):

```tsx
import { useShareEvent } from '@/hooks/use-share-event';
```

(b) Instantiate the hook next to the other hooks (after line 61 `const { mutate: saveEvent } = useSaveEvent();`):

```tsx
const shareEvent = useShareEvent();
```

(c) Add a handler next to `handleToggleSave` (after line 78). `formattedDate` is already computed at line 126 but is declared below this point — instead pass a freshly formatted label so ordering is irrelevant:

```tsx
const handleShare = () => {
  void shareEvent(event.id, event.title, formatDetailDate(event.dateStart));
};
```

(d) Pass `onShare` to the header — change line 137 from:

```tsx
<EventDetailHeader onBack={onBack} isSaved={isSaved} onToggleSave={handleToggleSave} />
```

to:

```tsx
<EventDetailHeader
  onBack={onBack}
  isSaved={isSaved}
  onToggleSave={handleToggleSave}
  onShare={handleShare}
/>
```

> `formatDetailDate` is the module-scope function already defined at the bottom of this file (line 326), so it is in scope for `handleShare`.

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @CeolX/native exec tsc --noEmit`
Expected: PASS. (Any other call sites of `EventDetailHeader`? There are none — it is only rendered here; grep `EventDetailHeader` to confirm before finishing.)

Run: `rg -n "EventDetailHeader" apps/native --glob '*.tsx'`
Expected: only the definition + this single usage.

- [ ] **Step 4: Commit**

```bash
git add apps/native/components/event-detail/EventDetailHeader.tsx apps/native/components/event-detail/EventDetailView.tsx
git commit -m "✨ feat(native): add share button to the event detail header"
```

---

## Task 7: Thin deep-link landing route `(app)/event/[eventId]`

**Files:**

- Create: `apps/native/app/(app)/event/_layout.tsx`
- Create: `apps/native/app/(app)/event/[eventId].tsx`

- [ ] **Step 1: Create the stack layout (mirrors `app/(app)/post/_layout.tsx`)**

Create `apps/native/app/(app)/event/_layout.tsx`:

```tsx
import { Stack } from 'expo-router';

export default function EventDeepLinkLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#080808' },
      }}
    >
      <Stack.Screen name="[eventId]" />
    </Stack>
  );
}
```

- [ ] **Step 2: Create the redirect screen**

Create `apps/native/app/(app)/event/[eventId].tsx`:

```tsx
import { Redirect, useLocalSearchParams } from 'expo-router';
import type { Href } from 'expo-router';

/**
 * Deep-link landing for shared event links (`ceolx.com/event/<id>` /
 * `ceolx://event/<id>`). Events live inside the tab stack, so this thin
 * top-level route immediately forwards to the canonical discover event detail
 * screen — reusing EventDetailScreen with no UI duplication. Mirrors how
 * app/(app)/post/[postId].tsx anchors shared post links.
 */
export default function EventDeepLinkScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();

  if (!eventId) {
    return <Redirect href="/(app)/(tabs)/discover" />;
  }

  return <Redirect href={`/(app)/(tabs)/discover/event/${eventId}` as Href} />;
}
```

> The `as Href` cast matches the pattern in `lib/notification-route.ts` — Expo's typed routes don't know runtime-built dynamic paths.

- [ ] **Step 3: Typecheck + confirm the route resolves**

Run: `pnpm --filter @CeolX/native exec tsc --noEmit`
Expected: PASS.

The `(app)/_layout.tsx` `Stack` lists explicit screens but does NOT enumerate `post` (Expo Router auto-discovers folder routes; explicit `Stack.Screen` only sets options). `event` will likewise auto-register via its own `_layout.tsx`, exactly like `post`. No change to `(app)/_layout.tsx` is required.

- [ ] **Step 4: Commit**

```bash
git add "apps/native/app/(app)/event/_layout.tsx" "apps/native/app/(app)/event/[eventId].tsx"
git commit -m "✨ feat(native): add event deep-link landing route that redirects to detail"
```

---

## Task 8: Android intent filter for `/event`

**Files:**

- Modify: `apps/native/app.config.js`

- [ ] **Step 1: Add the `/event` data entry**

In `apps/native/app.config.js`, the Android `intentFilters` array currently has one filter scoped to `/post`. Add a second `data` entry for `/event` in the SAME filter (the array of `data` objects supports multiple path prefixes under one VIEW/autoVerify filter). Change:

```js
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [{ scheme: 'https', host: SHARE_HOST, pathPrefix: '/post' }],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
```

to:

```js
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [
          { scheme: 'https', host: SHARE_HOST, pathPrefix: '/post' },
          { scheme: 'https', host: SHARE_HOST, pathPrefix: '/event' },
        ],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
```

(iOS `associatedDomains: ['applinks:${SHARE_HOST}']` is host-level and already covers `/event` — the per-path scope is enforced server-side by the AASA from Task 3, so no iOS app.config change is needed.)

- [ ] **Step 2: Verify the config still evaluates**

Run: `node -e "require('./apps/native/app.config.js'); console.log('config ok')"`
Expected: prints `config ok` (no throw). If it errors on missing env, run with the same env you use for `expo start` — a successful parse is the goal, not specific values.

- [ ] **Step 3: Commit**

```bash
git add apps/native/app.config.js
git commit -m "✨ feat(native): add /event android app-link intent filter"
```

> ⚠️ This change is native-config and only takes effect in a fresh EAS build — Android App Link verification for `/event/*` will NOT activate via `eas update` (OTA). Flag this in the EOD note and the PR description.

---

## Task 9: Defensive singular `/event/:id` notification remap

**Files:**

- Modify: `apps/native/lib/notification-route.ts`
- Test: `apps/native/lib/__tests__/notification-route.test.ts`

- [ ] **Step 1: Add a failing test**

In `apps/native/lib/__tests__/notification-route.test.ts`, add a case asserting the singular shared-link shape resolves to the discover event screen (place it next to the existing `/events/:id` test — search for `events/` to find it):

```ts
it('remaps the singular shared-link event shape /event/:id to the discover detail', () => {
  expect(resolveNotificationRoute('/event/abc-123')).toBe('/(app)/(tabs)/discover/event/abc-123');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @CeolX/native test lib/__tests__/notification-route.test.ts`
Expected: FAIL — returns `/(app)/(tabs)/discover` (the catch-all) instead of the event path.

- [ ] **Step 3: Add the singular branch**

In `apps/native/lib/notification-route.ts`, add a branch directly after the existing plural `/events/:id` branch (after line 30):

```ts
// Singular shared-link event shape: /event/:id — the shape shared links use
// (apps/native/hooks/use-share-event.ts) and the deep-link landing route.
const sharedEvent = route.match(/^\/event\/([^/]+)$/);
if (sharedEvent) return `/(app)/(tabs)/discover/event/${sharedEvent[1]}` as Href;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @CeolX/native test lib/__tests__/notification-route.test.ts`
Expected: PASS (new case + all existing cases).

- [ ] **Step 5: Commit**

```bash
git add apps/native/lib/notification-route.ts apps/native/lib/__tests__/notification-route.test.ts
git commit -m "✨ feat(native): remap singular /event/:id route to discover detail"
```

---

## Task 10: Full verification sweep

- [ ] **Step 1: Run the server test suite**

Run: `pnpm --filter @CeolX/server test`
Expected: PASS — post-share, event-share, and app-links suites all green.

- [ ] **Step 2: Run the native test suite**

Run: `pnpm --filter @CeolX/native test`
Expected: PASS — notification-route and any other suites green.

- [ ] **Step 3: Typecheck both packages**

Run: `pnpm --filter @CeolX/server exec tsc --noEmit && pnpm --filter @CeolX/native exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Lint the changed files**

Run: `pnpm lint` (or the repo's configured lint task — check `package.json` scripts).
Expected: PASS (no new violations; no `StyleSheet.create`, classNames only).

- [ ] **Step 5: Manual smoke (documented, run by Priya)**

- App installed (after a fresh dev/EAS build): tap Share on an event → share sheet shows `ceolx.com/event/<id>` → opening that link on the device lands on the event detail screen.
- App absent / desktop: open `https://<staging-host>/event/<active-id>` → OG card with cover + title + "date · venue" + store buttons. Open `/event/<removed-id>` and `/event/not-a-uuid` → not-found card, HTTP 404.

---

## Self-Review Notes (resolved)

- **Spec coverage:** every spec component maps to a task — hook (T5), header icon (T6), deep-link route + layout (T7), `event-share.ts` + app.ts (T2), shared shell extraction (T1, called out in spec), app-links widening (T3), vercel.json (T4), app.config intent filter (T8), notification-route remap (T9). Tests in T1–T3, T6, T9; verification sweep T10.
- **Spec deviation (intentional):** spec named `EventDetailScreen.tsx` for the share wiring; the `EventDetailHeader` is actually rendered in `EventDetailView.tsx`, so T6 targets that file. Same behaviour, correct location.
- **No `deletedAt` on events:** the gate is `status !== 'active'` (covers removed + archived + draft), confirmed against `packages/db/src/schema/events.ts`.
- **Type/name consistency:** `useShareEvent(eventId, title, dateLabel)` defined T5, called T6; `renderSharePage`/`renderNotFoundPage`/`storeUrls`/`SHARE_ORIGIN`/`SHARE_CSP`/`UUID_RE` defined T1, consumed T1 (post) + T2 (event); `LINK_PATH_GLOBS` defined + consumed in T3.

```

```
