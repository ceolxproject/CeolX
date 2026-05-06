# CeolX QA — Staging Android Install Guide

## What you're testing

The **CeolX (Staging)** app — a separate build from the production CeolX app, pointing at a staging backend (`api-staging.ceolx.ie`) and a staging database. **Use a fresh email address for staging accounts** — staging data is regularly wiped and not synced with production.

## Prerequisites

- Android 8 (Oreo) or newer.
- Chrome browser on the device.
- Permission to install apps from "unknown sources" (Chrome will prompt the first time).

## Install

1. Open the install URL shared by the dev team in **Chrome on your Android device**:
   `https://expo.dev/install/<id>`
2. Tap **Install build** on the Expo page.
3. Android prompts "Install unknown apps". Tap **Settings** → toggle **Allow from this source** for Chrome.
4. Return to the install page → tap Install again. The APK downloads and installs.
5. Open the **CeolX (Staging)** app from your home screen (icon name distinguishes it from prod).

## Updates

- The dev team ships JavaScript-only fixes via Expo's Over-The-Air (OTA) updates. These apply automatically: cold-start the app, wait ~3 seconds, kill from recents, reopen — the update is now applied.
- Native-code or dependency changes require a **new APK install** — you'll get a new install URL when this happens.

## Reporting bugs

Log issues in Asana project `1210959953917909`. Include:

- **Build ID** (Settings → About in the app, or pull from the install URL)
- **Account email** used to reproduce
- **Device model + Android version**
- **Steps to reproduce**
- **Screenshot or screen recording**

## What to ignore

- The icon and app name are intentionally different from production — this is how you confirm you're on the staging build.
- Postmark emails on staging may have a slight delay (~2 min) vs production.
- **Stripe subscriptions are not yet enabled on staging** — Artist and Venue subscription flows are out of scope for this build. If you hit an "activate subscription" prompt, log it as informational, not blocking.
