# Share Button for Events — Design

- **Date:** 2026-06-12
- **Asana:** [Share Button for events](https://app.asana.com/1/1194107417268910/project/1210959953917909/task/1215479230887625) (1215479230887625)
- **Author:** Priya Yadav
- **Status:** Approved — ready for implementation plan

## Summary

Add a native Share button to the event detail screen. Tapping it opens the OS
share sheet with a `https://ceolx.ie/event/<id>` link. On a device with the app
installed, iOS Universal Links / Android App Links route the tap back into the
app and land on the event detail screen. On a device without the app (or a
desktop browser / in-app webview), the link unfurls with the event's cover
image, title, date, and venue, and offers App Store / Play Store buttons.

This is a structural parallel of the existing **post-share** system
(`apps/native/hooks/use-share-post.ts`, `apps/server/src/routes/post-share.ts`,
`apps/server/src/routes/app-links.ts`). The design reuses that infrastructure
wholesale; only three things differ from posts:

1. **Deep-link landing** — events live inside a tab stack, so a thin top-level
   redirect route forwards to the canonical detail screen (posts have a
   dedicated top-level screen already).
2. **OG fields** — date + venue instead of a caption.
3. **Path-glob widening** — the AASA / App Links ownership files and the Vercel
   rewrite must now advertise _two_ link shapes (`/post/*` **and** `/event/*`),
   not one. The existing `app-links.ts` comment explicitly anticipated this:
   _"Widen both sides together if more deep-linkable web routes appear."_

## Decisions (confirmed)

| Decision               | Choice                                                                                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Share button placement | Event **detail header only**, a `share-outline` icon left of the existing bookmark icon.                                                               |
| OG card content        | Cover image (`coverImage`) + title + description = formatted date + venue/address.                                                                     |
| Deep-link landing      | Thin top-level `(app)/event/[eventId]` route that redirects to `(app)/(tabs)/discover/event/<id>`. Reuses `EventDetailScreen`, no UI duplication.      |
| Share message text     | `Check out {title} on CeolX\n{formatted date}\n{url}`                                                                                                  |
| Non-active events      | Only `status = 'active'` events unfurl. Removed (admin takedown) / archived / missing / non-UUID → existing not-found card, `Cache-Control: no-store`. |

## Architecture

```
Native app                  Hono server (api.ceolx.ie)         Admin (ceolx.ie / Vercel)
──────────                  ──────────────────────────         ─────────────────────────
use-share-event.ts     →    GET /event/:id (event-share.ts) ←  vercel.json rewrite /event/*
  Share sheet                 OG card + store buttons             → api.ceolx.ie/event/*
  ceolx.ie/event/<id>
                            /.well-known/* (app-links.ts)
EventDetailHeader.tsx         now advertises /post/* AND /event/*
  share icon
                            AASA + assetlinks list both globs
(app)/event/[eventId]
  redirect → discover/event detail
```

### Flow — app installed

OS verifies AASA (iOS) / assetlinks (Android) → opens the app at `/event/<id>`
→ `(app)/event/[eventId]` renders `<Redirect href="/(app)/(tabs)/discover/event/<id>" />`
→ `EventDetailScreen`. The web fallback page is never rendered.

### Flow — app not installed

Vercel rewrites `ceolx.ie/event/<id>` → `api.ceolx.ie/event/<id>` (rewrite, not
redirect — Apple requires the AASA host to stay stable; same rule already in
place for `/post/*` and `/.well-known/*`). Hono renders the OG card with an
"Open in the CeolX app" deep link plus store buttons. Deliberately **no**
auto-redirect into `ceolx://` — most hits here are people without the app, and a
top-level custom-scheme navigation on iOS Safari throws a visible error when the
app is absent (same rationale as post-share).

## Components

### Native — `apps/native`

**`hooks/use-share-event.ts`** _(new)_
Clone of `use-share-post.ts`. Signature `(eventId: string, title: string, dateLabel: string)`.
Builds `${SHARE_BASE_URL}/event/${eventId}` where
`SHARE_BASE_URL = env.EXPO_PUBLIC_SHARE_BASE_URL ?? 'https://ceolx.ie'`. Opens
`Share.share({ url, message: \`Check out ${title} on CeolX\n${dateLabel}\n${url}\`, title: 'Check out this event on CeolX' })`.
On throw → `Alert.alert('Unable to share', 'Please try again.')`.

**`app/(app)/event/[eventId].tsx`** _(new)_
Thin deep-link landing. Reads `eventId` from `useLocalSearchParams` and returns
`<Redirect href={\`/(app)/(tabs)/discover/event/${eventId}\`} />`. Registered in
the existing `(app)`stack the same way the post route is registered (verify the`(app)/\_layout`/`(app)/post/\_layout`pattern during implementation and mirror
it — a`(app)/event/\_layout.tsx`with`headerShown: false` if posts use one).

**`components/event-detail/EventDetailHeader.tsx`** _(edit)_
Add an optional `onShare?: () => void` prop and, when present, a
`<Pressable onPress={onShare}>` with `<Ionicons name="share-outline" size={23} />`
placed left of the bookmark `Pressable`, inside the existing right-hand
`flex-row gap-4` group.

**`components/event-detail/EventDetailScreen.tsx`** _(edit)_
Instantiate `useShareEvent()` and pass `onShare` to `EventDetailHeader`, supplying
the event title and a formatted date label (reuse whatever date formatter the
detail view already uses for the date info row).

**`app.config.js`** _(edit)_
Add a `pathPrefix: '/event'` entry to the Android `intentFilters` `data` array
(alongside the existing `/post`). iOS `associatedDomains` is host-level
(`applinks:${SHARE_HOST}`) and already covers any path — the path scope lives in
the server-side AASA, so no iOS app-config change is needed.

**`lib/notification-route.ts`** _(edit, small)_
Add a `/event/:id` (singular) bare-path remap next to the existing `/events/:id`
branch, both resolving to `/(app)/(tabs)/discover/event/<id>`. Defensive — keeps
the singular shared-link shape from 404-ing if it ever flows through the inbox.

### Server — `apps/server`

**`routes/event-share.ts`** _(new)_
`GET /event/:id`.

- UUID-validate with the same `UUID_RE`; non-UUID → not-found card, `no-store`, 404.
- Load the event with its venue relation (`db.query.events.findFirst` with
  `{ with: { venue: true } }`).
- Treat anything not `status === 'active'` (including `deletedAt`, `removed`,
  `archived`) and any missing row as not-found (`no-store`, 404). Only active
  events unfurl.
- OG card:
  - `og:image` = `event.coverImage` (omit image tags when null, falling back to
    `twitter:card = summary`, same as post).
  - title = `event.title`.
  - description = `"<formatted date> · <venue name | venueAddress | 'CeolX'>"`,
    truncated to ~200 chars.
- Same CSP header, same `Cache-Control: public, max-age=300, s-maxage=300` on
  success, same store-button env fallbacks (`IOS_APP_STORE_URL`,
  `ANDROID_PLAY_STORE_URL`).
- Deep link emitted on the page = `ceolx://event/<id>`.

**Shared HTML shell.** Rather than copy `renderPostSharePage`'s ~60 lines of
markup, extract the common shell into a small helper (e.g.
`routes/share-page.ts` exporting `renderSharePage({ title, description, ogImage,
deepLink, url, iosStoreUrl, androidStoreUrl })` plus `escapeHtml`). `post-share.ts`
and `event-share.ts` both call it with their entity-specific values. This keeps
the two routes to just their data-loading + field-derivation logic and removes
the duplication that copying would introduce.

**`routes/app-links.ts`** _(edit)_
Replace the single `LINK_PATH_GLOB = '/post/*'` with a list
`LINK_PATH_GLOBS = ['/post/*', '/event/*']`. Emit one `components` entry per glob
in the AASA `details`. `assetlinks.json` is host/relation-level and needs no
change. Update the file's header comment (currently "scoped to `/post/*`").

**`app.ts`** _(edit)_
Import `eventShareRoute` and add `app.route('/', eventShareRoute)` next to the
existing `app.route('/', postShareRoute)`.

### Admin — `apps/admin`

**`vercel.json`** _(edit)_
Add `{ "source": "/event/:path*", "destination": "https://api.ceolx.ie/event/:path*" }`
immediately after the existing `/post/:path*` rewrite and **before** the
`/(.*) → /index.html` SPA catch-all (order matters — the catch-all would
otherwise swallow it).

## Testing

- **`apps/server/src/__tests__/routes/event-share.test.ts`** _(new)_ — clone of
  `post-share.test.ts`:
  - active event → 200, OG title/description/image tags present, cover image in
    `og:image`, deep link `ceolx://event/<id>`.
  - event with no `coverImage` → 200, `twitter:card = summary`, no `og:image`.
  - non-UUID id → 404 not-found card, `no-store`.
  - missing / `deletedAt` / `removed` / `archived` event → 404 not-found card.
- **`apps/server/src/__tests__/routes/app-links.test.ts`** _(edit)_ — assert the
  AASA `components` now contains **both** `/post/*` and `/event/*`; assetlinks
  unchanged.
- Native hook is a thin wrapper over `Share.share`; cover via the existing test
  conventions if `use-share-post` has a test, otherwise no new native test
  (parity with how post-share is tested).

## Out of scope (YAGNI)

- Share affordance on event cards in the feed/list (header only for V1).
- Share analytics / click tracking.
- Per-event Open Graph for archived "past events" (only active events unfurl).
- A custom App Store numeric id (still uses the search fallback until the app is
  published, same as post-share).

## Risk notes

- **Native config changes need a rebuild, not OTA.** `app.config.js`
  `intentFilters` and any new associated-domain scope are baked into the native
  binary — Android App Link verification for `/event/*` only takes effect in a
  fresh EAS build, not an `eas update`. The JS/server/Vercel pieces ship
  normally. Flag this in the implementation plan and in the EOD note.
- **Three deploy targets move together.** Native (rebuild), server
  (api.ceolx.ie), and admin (ceolx.ie Vercel) must all carry the change for the
  end-to-end flow to work; a partial deploy degrades gracefully (e.g. server
  live but app not rebuilt → web fallback works, in-app deep link does not).
