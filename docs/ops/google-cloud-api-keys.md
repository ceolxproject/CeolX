# Google Cloud API keys — setup runbook

CeolX uses **two separate Google API keys** that people routinely confuse. They live in Google Cloud, not Firebase, and they must never be swapped for each other.

Written 28/07/2026 after a production incident where map place search broke because the key in use belonged to a project with no billing account and neither required API enabled. Every command in here was run against the real project.

---

## 0. The two keys, and why they can't be shared

|                   | `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`                | `GOOGLE_MAPS_API_KEY`                            |
| ----------------- | ------------------------------------------------ | ------------------------------------------------ |
| Used by           | The mobile app, for rendering the map            | The Hono server, for place + address lookup      |
| Google APIs       | Maps SDK for Android, Maps SDK for iOS           | **Places API (New)**, Geocoding API              |
| Ships where       | Inlined into `AndroidManifest.xml` at build time | Server-side only, never in the bundle            |
| Restriction type  | **Application** (package + SHA-1, bundle id)     | **API** restriction only                         |
| Configured in     | `eas.json` + EAS environment variables           | Vercel env vars + encrypted `apps/server/.env.*` |
| Rotating it needs | A native rebuild **and a store release**         | A Vercel env change — no release                 |

**Never use one key for both.** The client key must be locked to your app's signing certificate; the server key can't be, because Vercel isn't an app. Sharing one key means neither can be restricted properly, and you'd be shipping a key inside the APK that can also bill Geocoding calls.

> **Firebase is unrelated.** `google-services.json` carries a _third_ key (`AIzaSyDHRzzt…` in prod) used only for FCM. The Firebase console's SHA fingerprint list is for Google Sign-In, **not** for Maps. Nothing on this page is configured in Firebase.

---

## 1. Prerequisite: a billing account

**Google Maps APIs require an active billing account, even inside the free monthly allowance.** There is no free-without-billing path. If billing is inactive — including a free trial that has expired — every Maps API returns an error.

Check with:

```bash
gcloud billing projects describe <project-id> --format="value(billingEnabled)"
```

`False` means nothing will work until an account is linked, regardless of which APIs are enabled.

> **Don't attach billing to the Firebase project** (`ceolx-22bf1`) unless you intend to. Linking a billing account upgrades Firebase from Spark to **Blaze** (pay-as-you-go), which affects FCM and every other Firebase service, not just Maps. Use a **separate, non-Firebase project** for Maps keys so the billing decision stays isolated.

---

## 2. Enable the APIs

GCP Console → **APIs & Services → Library**, and enable each of these **by exact name**:

| API                      | Needed for                                      |
| ------------------------ | ----------------------------------------------- |
| **Places API (New)**     | Server: `/location/geocode` place + town search |
| **Geocoding API**        | Server: `/location/reverse-geocode`             |
| **Maps SDK for Android** | App: map rendering on Android                   |
| **Maps SDK for iOS**     | App: map rendering on iOS                       |

**The single most common mistake:** `Places API` and `Places API (New)` are _different products_ with separate console tiles and separate billing. Enabling the legacy one does **not** enable the new one. Our server calls `places.googleapis.com/v1/places:searchText` (see `apps/server/src/routes/location.ts`), which is the **New** API.

When the new API is missing, Google returns a bare `403 PERMISSION_DENIED / "The caller does not have permission"` with **no hint that an API needs enabling**. That message is the signature of this mistake.

---

## 3. Create the server key (Places + Geocoding)

**APIs & Services → Credentials → Create credentials → API key.** Name it something like `ceolx-server-geocoding`.

Then **Edit API key**:

- **API restrictions** → _Restrict key_ → select only **Places API (New)** and **Geocoding API**.
- **Application restrictions** → leave as **None**.

  Vercel's serverless egress IPs are dynamic, so an IP allowlist isn't practical without their static-egress add-on. Do **not** set an Android/iOS restriction — the caller is a server, and it will 403.

- **Quotas** (`APIs & Services → Quotas`) → set a **daily request cap** per API.

  This is the real cost control. An unrestricted key with no cap means anyone who obtains it can bill your account without limit. The cap bounds the damage to a known number.

### Where the value goes

1. **Vercel** → project `ceol-x-server` → Settings → Environment Variables → `GOOGLE_MAPS_API_KEY`, for **Production** and **Preview**. This is what the deployed server actually reads.
2. **Local + encrypted repo copies** — set it in `apps/server/.env`, `apps/server/.env.staging`, `apps/server/.env.production`, then:

   ```bash
   pnpm env:encrypt      # regenerates the tracked *.gpg files
   ```

   Plaintext `.env*` files are gitignored; only the `.gpg` files are committed. The passphrase comes from `.envrc` (`PRODUCTION_SECRET` / `STAGING_SECRET` / `DEVELOPMENT_SECRET`), which is **also gitignored** — never commit it.

> Editing `apps/server/.env` does nothing for production. The deployed server reads Vercel's variables. Both must be updated.

---

## 4. Create the client key (Maps SDK)

**Create credentials → API key**, named e.g. `ceolx-mobile-maps`.

- **API restrictions** → _Restrict key_ → **Maps SDK for Android** and **Maps SDK for iOS** only.
- **Application restrictions** → **Android apps**, then add one entry per variant:

  | Package name            | Which SHA-1                            |
  | ----------------------- | -------------------------------------- |
  | `com.ceolx.app`         | Production **Play App Signing** cert   |
  | `com.ceolx.app.staging` | Staging **Play App Signing** cert      |
  | `com.ceolx.app`         | EAS upload key                         |
  | `com.ceolx.app`         | Local debug keystore (dev builds only) |

  Also add the iOS bundle ids under **iOS apps**.

### Getting each SHA-1

**Play App Signing cert (the one that matters for store builds):** Play Console → _Test and release → Setup → App integrity → App signing key certificate_. It is **not derivable locally**.

Google Play **re-signs** your uploaded `.aab`, so the app users install carries the Play App Signing certificate, not your upload key. Registering only the upload key's SHA gives a **blank map on store builds** — this is documented in `docs/handoff/01-gotchas.md` too.

**Local debug keystore** (needed for `expo run:android`, which builds `assembleDebug`):

```bash
keytool -list -v -keystore apps/native/android/app/debug.keystore -storepass android \
  | grep SHA1
```

On this repo that is currently:

```
5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25
```

Without it registered, **local debug builds show a grey map** while staging and production work fine. That asymmetry is normal and is not a code bug.

### Where the value goes

- **`apps/native/eas.json`** → `build.production.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`
- **EAS environment variables** for the `preview` environment (staging reads from there, not from `eas.json`):

  ```bash
  npx eas env:list --environment preview
  ```

- `apps/native/.env.development` for local builds

The wiring is currently inconsistent — production reads from `eas.json`, staging from EAS env vars. Worth unifying; just know both places exist so a change in one doesn't look like it silently did nothing.

**Changing this key requires a native rebuild and a store release.** It is injected into `AndroidManifest.xml` by the `react-native-maps` config plugin (`apps/native/app.config.js`), so an OTA update cannot change it. Plan rotations accordingly — you cannot hot-fix this key.

---

## 5. Verify

Server key, Places API (New) — expect `200` and a result:

```bash
curl -s -X POST "https://places.googleapis.com/v1/places:searchText" \
  -H "Content-Type: application/json" \
  -H "X-Goog-Api-Key: $KEY" \
  -H "X-Goog-FieldMask: places.displayName,places.formattedAddress,places.location" \
  -d '{"textQuery":"Temple Bar Dublin"}'
```

Server key, Geocoding API:

```bash
curl -s "https://maps.googleapis.com/maps/api/geocode/json?latlng=53.3498,-6.2603&key=$KEY"
```

Through the deployed server — expect `{"ok":true,...}`, not `upstream_error`:

```bash
curl -s "https://api.ceolx.com/location/geocode?q=Dublin"
curl -s "https://api.ceolx.com/location/reverse-geocode?lat=53.3498&lng=-6.2603"
curl -s "https://api-staging.ceolx.com/location/geocode?q=Galway"
```

Client key: it cannot be verified with `curl`, because an app-restricted key rejects any caller without an app signature. Verify on a device and read the log:

```bash
adb logcat | grep -iE "Google Maps|Authorization"
```

The SDK prints the exact package and SHA it expected, which is the fastest way to diagnose a mismatch.

---

## 6. Troubleshooting

| Symptom                                                                             | Cause                                                                     | Fix                                          |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------- |
| `403 PERMISSION_DENIED` "The caller does not have permission" from Places           | **Places API (New)** not enabled, or not in the key's API allowlist       | §2, then re-check the key's API restrictions |
| `REQUEST_DENIED` "You must enable Billing"                                          | No active billing account on the key's project                            | §1                                           |
| Server returns `upstream_error`                                                     | Any upstream failure; Google's real body is logged                        | Vercel → Logs → search `places responded`    |
| Server returns `not_configured` (503)                                               | `GOOGLE_MAPS_API_KEY` unset in that environment                           | §3                                           |
| Blank/grey map on a **store** build                                                 | Play App Signing SHA-1 not registered                                     | §4                                           |
| Blank/grey map on a **local debug** build only                                      | Debug keystore SHA-1 not registered                                       | §4                                           |
| `This IP, site or mobile application is not authorized` when curling the client key | Expected — it is app-restricted                                           | Not a fault; verify on device instead        |
| Enabled everything and it still 403s                                                | API enabled project-wide but missing from the **key's** own API allowlist | Edit key → API restrictions                  |

Server-side changes (API enablement, billing, key restrictions) are Google-side config and take effect in about 5 minutes with **no deploy and no app release**. An already-installed build starts working after a force-quit and reopen.

---

## 7. Ownership

**Keys must live in a project owned by a role account, not an individual.** Both keys were originally created in a project outside `ceolxproject@gmail.com`, and when the author left, nobody could reach the console to diagnose or rotate them. Diagnosis of the July 2026 incident took hours mostly because no record existed of which Google account owned which project.

Requirements going forward:

- Two or more **Owners** on the project, at least one a role account.
- Record the owning account and project id below whenever a key is created or rotated.
- Never let a client-side key's project depend on a personal billing account or a free trial. The client key **cannot be rotated without a store release**, so an expiring trial behind it is a multi-day outage, not a quick fix.

### Current keys

| Purpose                      | Project / account                       | Notes                                                                                                                                                            |
| ---------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Server (Places + Geocoding)  | `ceolxmusic@gmail.com`, billing enabled | Rotated 28/07/2026. **Still unrestricted — needs §3 restrictions + quota cap.**                                                                                  |
| Client (Maps SDK)            | **Unconfirmed**                         | Not in `ceolx-22bf1` or `ceolx-staging`. Confirm the owning project and its billing state — if trial-backed, plan the rotation into a release before it expires. |
| FCM (`google-services.json`) | `ceolx-22bf1` (Spark)                   | Unrelated to Maps. Spark is fine for FCM.                                                                                                                        |
