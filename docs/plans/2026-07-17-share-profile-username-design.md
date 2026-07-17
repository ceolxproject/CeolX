# Share Profile via Username Handle — Design

**Date:** 2026-07-17
**Status:** Approved design, not yet implemented
**Scope:** Artist & Venue profile sharing. Spectators excluded (no public profile).

## Problem

Events and posts have shareable links (`ceolx.com/event/<uuid>`, `/post/<uuid>`).
Artists and venues have no way to share their profile. Public profiles are
already searchable in-app; a share link is just a shortcut to the same page.
The raw public identifier today is the BetterAuth `user.id` (text) — not
shareable-friendly. We need a human handle.

## Decision summary

| Decision         | Choice                                               | Why                                                                                                                                                         |
| ---------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Handle mechanism | better-auth `username` plugin                        | First-party, already the auth stack; gives `displayUsername`, validation, `isUsernameAvailable`, reserved words. DB cost identical to a hand-rolled column. |
| Where it lives   | `user` row (`username`, `displayUsername`), nullable | One place, global uniqueness, works for both profile types; spectators stay `null`.                                                                         |
| URL shape        | `ceolx.com/@username` (unified)                      | Cleanest handle; server resolves artist vs venue; no collision with `/event` `/post`.                                                                       |
| Editability      | One-time, permanent (confirm step)                   | Shared links never rot (flyers/socials). Rare typo → admin DB edit.                                                                                         |
| Backfill         | Set-on-first-share                                   | No migration/forced modal. Picker opens inline on first Share tap.                                                                                          |
| Visibility       | Mirrors in-app search visibility                     | Link renders profile only when live; not-live/deleted → not-found landing.                                                                                  |

## Validator (single source of truth)

`packages/shared/src/validators/` — reused by onboarding form, first-share
picker, and the plugin's `usernameValidator`.

```ts
export const usernameSchema = z
  .string()
  .min(3)
  .max(20)
  .regex(/^[a-z0-9_]+$/, 'lowercase letters, numbers, underscore only')
  .regex(/[a-z]/, 'must contain a letter')
  .refine((u) => !RESERVED.has(u), 'that handle is taken');
// RESERVED: event, post, subscribe, admin, api, r, well-known, @
```

- lowercase only, `a-z 0-9 _`, 3–20 chars, must contain a letter.
- dot dropped (plugin default allows it; reads as a file extension in URLs).

## 1. Data model & auth

`packages/auth/src/index.ts`:

```ts
plugins: [
  expo(),
  username({
    minUsernameLength: 3,
    maxUsernameLength: 20,
    usernameValidator: (u) => usernameSchema.safeParse(u).success,
  }),
];
```

- Adds nullable `username` (normalized) + `displayUsername` to `user`.
- Add an explicit `UNIQUE` index on `username` in the Drizzle schema — the DB
  is the backstop for the check-then-write race.
- `signIn.username` endpoint ships but is never wired into the UI. Login stays
  email/Google/Apple.

## 2. Client — setting the handle & sharing

Shared `<UsernamePicker>` (live availability via `isUsernameAvailable`, format
via `usernameSchema`, confirm-permanent inside), two entry points:

- **New artist/venue:** required field in the existing onboarding step →
  `updateUser({ username })`.
- **Existing (no handle):** set-on-first-share. Share tap with `username == null`
  opens the picker → confirm → `updateUser` → share sheet fires.

`apps/native/hooks/use-share-profile.ts` (mirrors `use-share-event.ts`):

```ts
export function useShareProfile() {
  const me = useMe();
  return useCallback(async () => {
    let handle = me.username;
    if (!handle) handle = await promptUsernamePicker(); // null if cancelled
    if (!handle) return;
    await Share.share({
      url: `${SHARE_BASE_URL}/@${handle}`,
      message: `Check out ${me.displayName} on CeolX`,
    });
  }, [me]);
}
```

- Share button renders only when the profile is live (same flag the profile
  screen already uses to decide it's public). Spectators never see it.
- `displayUsername` shown in UI (`@PriyaMusic`); normalized `username` in the URL.

## 3. Public link & deep-link plumbing

**Resolver API** `profiles.getByUsername(username)`: look up `user` by
normalized username → `current_role` disambiguates artist/venue → if live,
return `{ role, userId, displayName, image, bio }`, else `null`. No join.

**App route** `apps/native/app/(app)/@[username].tsx`: thin shim — resolve, then
redirect to the existing `/artist/[artistId]` or `/venue/[venueId]` screen
(which already resolve by `user.id`). Profile screens untouched.

**Server landing** `apps/server/src/routes/profile-share.ts`: `GET /@:username`,
reuse `renderSharePage()`. Live → profile OG unfurl + store buttons;
null/not-live/deleted → `renderNotFoundPage()`. Guard swaps `UUID_RE` for the
username regex.

**Widen the three hard-coded scopes together:**

1. `apps/server/src/routes/app-links.ts` → add `/@*` to `LINK_PATH_GLOBS`.
2. `apps/native/app.config.js` → add `pathPrefix: '/@'` to Android
   `intentFilters` (iOS `associatedDomains` already covers the host).
3. admin `vercel.json` → rewrite `/@*` to the server for OG meta.

Custom scheme (`ceolx://@handle`) skipped — `@` can't be a scheme host and
external shares only need the HTTPS universal link.

## 4. Edge cases

- Spectator → `username` null, no picker, no share button.
- Not-live / deleted profile → resolver `null` → not-found landing.
- Handle taken → inline `isUsernameAvailable`; `UNIQUE` index backstops the race.
- Typo on permanent handle → confirm step; rare fixes via admin DB edit.
- Reserved word / bad format → `usernameSchema`.
- Picker cancelled → returns null, share aborts, no write.

## Not building (YAGNI)

- No login-by-username in the UI (endpoint exists, unused).
- No spectator usernames / hidden auto-generation — nullable covers it; one-line
  backfill _if_ ever wanted.
- No username-change UI, no redirect-history table.
- No custom-scheme profile deep link.
- No migration script — existing users self-claim on first share.

## Open follow-ups

- Confirm the exact profile-live flag the Share button should read
  (`artist_profiles.is_active` vs `venue_profiles.subscription_status`).
- Reserved-word list — confirm final set with Pratiksha if any marketing routes
  are planned at root.
