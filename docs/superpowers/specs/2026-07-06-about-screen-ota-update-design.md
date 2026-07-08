# Design: App Version + OTA Update Check ("About" screen)

**Date:** 2026-07-06
**Author:** Priya Yadav (with Claude)
**Status:** Approved design — pending implementation plan

## Goal

Give CeolX mobile users a visible app version and a one-tap "Check for Updates"
button that pulls the latest published EAS Update (OTA) bundle — mirroring the
pattern already shipping in the mentor project's About screen. Also apply a
pending OTA one launch sooner via a cold-start check.

## Context

- **OTA infrastructure already exists.** `apps/native/app.config.js` configures
  `updates.url` (`https://u.expo.dev/222e34aa-...`) and
  `runtimeVersion: { policy: 'fingerprint' }`. `expo-updates@~55.0.21`,
  `expo-constants`, and `@sentry/react-native@^7.11.0` are all installed. No new
  dependencies and no native rebuild are required — this is JS-only.
- **No About/version surface exists today.** Settings live in
  `apps/native/components/SettingsBottomSheet.tsx` (Change Password / Sign Out /
  Delete Account), reused from profile, venue, and artist screens.
- **Reference implementation:** `mentor/apps/mobile/lib/check-for-update.ts` and
  `mentor/apps/mobile/app/(stack)/about.tsx`.

### Key constraint — the boot path invariant

`apps/native/app/_layout.tsx` (lines 90–97, Asana 1215040939202673) documents a
hard-won rule: **the navigator must stay mounted at all times.** Returning `null`
while the app boots unmounts the navigator and races Expo Router's cold-start
deep-link restoration — that race previously dropped the reset-password deep link.

Mentor's `applyPendingUpdate` blocks **before** the navigator renders. Porting
that verbatim would reintroduce this race. CeolX must instead run the cold-start
check _without_ unmounting the navigator, and must not `reloadAsync()` while a
deep-link launch is in flight.

## Decisions (locked)

| Decision        | Choice                                                                                                                                   |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| UI surface      | Dedicated `/about` stack screen, linked from a new "About" row in `SettingsBottomSheet`                                                  |
| Scope           | Manual check **and** cold-start auto-apply                                                                                               |
| Deep-link guard | Cold-start `applyPendingUpdate` **skips** `reloadAsync()` when `Linking.getInitialURL()` is non-null; the OTA applies on the next launch |
| Build display   | Version + release channel + running-bundle source (embedded vs OTA)                                                                      |
| Styling         | App-native dark theme (`#0d0c0f` bg, `#C8FF2F` accent, `font-urbanist`, uniwind `className`) — **not** mentor's pink/StyleSheet          |
| Copy            | Inline English strings — no i18n (app is English-only per CLAUDE.md)                                                                     |

## Components

### 1. `apps/native/lib/check-for-update.ts` (new)

Three exports, ported from mentor with one CeolX adaptation.

- **`getRunningBundleInfo(): RunningBundleInfo`** — verbatim from mentor. Returns
  `{ source: 'embedded' }` or `{ source: 'ota'; updateId; createdAt }` from
  `Updates.isEmbeddedLaunch` / `Updates.updateId`. Feeds the About screen's
  bundle-source line.

- **`applyPendingUpdate(): Promise<boolean>`** — cold-start check, 3s + 3s
  timeout budget. Returns early (`false`) when `__DEV__` or `!Updates.isEnabled`.
  **CeolX adaptation:** before calling `Updates.reloadAsync()`, check
  `Linking.getInitialURL()`; if a launch URL is present, stage the update but
  return without reloading (the OTA applies on the next cold launch). This
  protects CeolX's known-fragile deep links.

- **`checkForUpdateManually(): Promise<ManualUpdateResult>`** — verbatim from
  mentor. 20s timeout per phase. Result variants:
  `{ status: 'disabled' | 'up_to_date' | 'applied' | 'error'; message? }`.
  Stages the update on `applied` but does **not** reload — the caller confirms
  first.

### 2. `apps/native/app/(app)/about.tsx` (new stack route)

Dark-themed screen (app palette, uniwind `className`, no `StyleSheet.create`):

- App icon (`assets/images/icon.png`), "CeolX" title, tagline.
- Version card: `v{Constants.expoConfig?.version ?? '—'}`, release channel
  (`Updates.channel ?? 'development'`), and bundle source from
  `getRunningBundleInfo()` (e.g. `staging · OTA update` or `staging · embedded`).
- "Check for Updates" `Pressable` (busy/disabled state) driving `Alert` dialogs:
  - `disabled` → "Updates aren't available in this build."
  - `up_to_date` → "You're on the latest version."
  - `applied` → confirm dialog; on confirm, `Updates.reloadAsync()` (rejections
    captured to Sentry, update stays staged for next launch).
  - `error` → generic message to the user; raw error captured to Sentry with
    `tags: { module: 'ota-update', op: 'manual_check' }`.
- Registered as a `Stack.Screen` under `app/(app)/_layout.tsx` (headerless,
  consistent with `change-password`, `notifications`, `add-location`).

### 3. `apps/native/components/SettingsBottomSheet.tsx` (edit)

Add an "About" row (info-circle icon, same visual pattern as existing rows)
between Sign Out and Delete Account. `onPress` dismisses the sheet and
`router.push('/about')`.

### 4. `apps/native/app/_layout.tsx` (edit)

Reuse the existing non-unmounting overlay mechanism:

- Add `const [updateChecked, setUpdateChecked] = useState(false)`.
- In a `useEffect` (fire-once), call `applyPendingUpdate()`; in `.finally`, set
  `updateChecked(true)`. (If it reloads, the process restarts and this never
  resolves — fine.)
- Extend the existing overlay condition from `!fontsReady` to
  `!fontsReady || !updateChecked`.
- **The navigator is never unmounted** — it stays mounted under the dark overlay,
  preserving the deep-link invariant. Overlay lifts when both fonts are ready and
  the update check has settled (or timed out at ~6s).

## Data flow

```
Cold start:
  _layout mounts navigator + overlay
    └─ applyPendingUpdate()
         ├─ __DEV__ / disabled / timeout / no update → setUpdateChecked(true) → overlay lifts
         ├─ update found, no deep-link launch → reloadAsync() (process restarts)
         └─ update found, deep-link launch in flight → stage only, setUpdateChecked(true), overlay lifts
                                                        (deep link delivered; OTA applies next launch)

Manual (About screen button):
  handleCheck() → checkForUpdateManually()
    ├─ up_to_date → success alert
    ├─ applied    → confirm alert → reloadAsync()
    ├─ disabled   → info alert
    └─ error      → Sentry.captureException + generic alert
```

## Error handling

- All helper failures resolve to result variants — the helper never throws to the
  UI.
- Manual-check errors and reload rejections are captured to Sentry (already
  initialized in `_layout.tsx`) with `module: 'ota-update'` tags; the user sees a
  generic, internals-free message.
- Cold-start `applyPendingUpdate` swallows all errors and lets the embedded bundle
  boot; default `ON_LOAD` polling retries next launch.

## Testing

Port `mentor/apps/mobile/lib/__tests__/check-for-update.test.ts` to
`apps/native/lib/__tests__/check-for-update.test.ts`:

- Mock `expo-updates` and `expo-linking`; override `global.__DEV__ = false`.
- `checkForUpdateManually`: disabled / up_to_date / applied (no reload) / error.
- **New:** `applyPendingUpdate` skips `reloadAsync()` when
  `Linking.getInitialURL()` resolves to a URL, and calls it when it resolves null.
- `getRunningBundleInfo`: embedded vs OTA branches.

## Out of scope

- No new EAS Update channels or config changes.
- No native module changes / rebuild.
- No i18n.
- No changes to venue/artist/profile screens beyond the shared `SettingsBottomSheet`.

## File summary

| File                                                 | Change                                    |
| ---------------------------------------------------- | ----------------------------------------- |
| `apps/native/lib/check-for-update.ts`                | new (3 fns)                               |
| `apps/native/lib/__tests__/check-for-update.test.ts` | new                                       |
| `apps/native/app/(app)/about.tsx`                    | new screen                                |
| `apps/native/app/(app)/_layout.tsx`                  | register `about` screen                   |
| `apps/native/components/SettingsBottomSheet.tsx`     | add "About" row                           |
| `apps/native/app/_layout.tsx`                        | cold-start check via overlay (no unmount) |
