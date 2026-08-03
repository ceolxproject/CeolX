# Google Cloud API keys — setup runbook

CeolX uses **two separate Google API keys** that people routinely confuse. They live in Google Cloud, not Firebase, and they must never be swapped for each other.

Written 28/07/2026 after a production incident where map place search broke because the key in use belonged to a project with no billing account and neither required API enabled. Every command in here was run against the real project.

---

## 0. The two keys, and why they can't be shared

|                   | `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`                         | `GOOGLE_MAPS_API_KEY`                            |
| ----------------- | --------------------------------------------------------- | ------------------------------------------------ |
| Used by           | The mobile app, for rendering the map                     | The Hono server, for place + address lookup      |
| Google APIs       | Maps SDK for Android (Android only — iOS uses Apple Maps) | **Places API (New)**, Geocoding API              |
| Ships where       | Inlined into `AndroidManifest.xml` at build time          | Server-side only, never in the bundle            |
| Restriction type  | **Application** (package + SHA-1, bundle id)              | **API** restriction only                         |
| Configured in     | `eas.json` + EAS environment variables                    | Vercel env vars + encrypted `apps/server/.env.*` |
| Rotating it needs | A native rebuild **and a store release**                  | A Vercel env change — no release                 |

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

> **Maps SDK for iOS is NOT needed.** iOS renders with **Apple Maps**, not Google — `app/(app)/(tabs)/map/index.tsx` passes `provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}`, and `undefined` means Apple Maps. Nothing in the iOS build calls a Google Maps SDK. (This page previously listed it as required; corrected 03/08/2026.)

**The second most common mistake — and it costs hours:** enabling the HTTP APIs (Geocoding, Places) but not **Maps SDK for Android**. They are separate products with separate console tiles, and the SDK is easy to skip because a key created through the Maps Platform wizard _lists_ it among selectable APIs whether or not it is enabled on the project.

A disabled Maps SDK for Android fails **identically to a bad SHA-1** — the Android SDK prints the same generic block naming a fingerprint and package:

```
E/Google Android Maps SDK: Authorization failure.
	Ensure that the "Maps SDK for Android" is enabled.
	API Key: AIza…
	Android Application (<cert_fingerprint>;<package_name>): FB:0C:…;com.ceolx.app.staging
```

That message is a **template**, not a diagnosis. It names a SHA and a package because those are the fields it always prints — not because the certificate is what failed. Do not start with §4; start with §6's decision tree.

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

- **API restrictions** → _Restrict key_ → **Maps SDK for Android** only. (No iOS SDK — see §2.) Selecting it here is not enough; it must also be **enabled on the project**, which is a separate action and the cause of the 03/08/2026 incident.
- **Application restrictions** → **Android apps**, then add one entry per variant:

  | Package name            | Which SHA-1                                    |
  | ----------------------- | ---------------------------------------------- |
  | `com.ceolx.app`         | Production **Play App Signing** cert           |
  | `com.ceolx.app.staging` | Staging **Play App Signing** cert              |
  | `com.ceolx.app`         | EAS upload key                                 |
  | `com.ceolx.app.staging` | Local debug keystore (`expo run:android` only) |

  No **iOS apps** entries are needed — iOS never calls a Google Maps SDK.

> **Turning restrictions on is fail-closed.** The moment you switch a key from _None_ to _Android apps_, only the listed pairs are authorized and every other caller is refused instantly. If one key serves both variants, every entry must be present in the **same save**, or you take the missing variant's map down. Have a device on the affected build in hand when you save, and be ready to revert to _None_.

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

Client key, on a device — the auth result is cached for the process lifetime, so a **force-stop is mandatory** or you will read a stale verdict:

```bash
adb logcat -c
adb shell am force-stop com.ceolx.app.staging
adb shell monkey -p com.ceolx.app.staging -c android.intent.category.LAUNCHER 1
sleep 25
adb logcat -d | grep -iE "Authorization failure|API Key:"      # empty = working
```

**Bisect a client-key failure in one step.** Temporarily set Application restrictions to **None**, wait 5 minutes, and re-run the above:

- still failing → the certificate was never the problem. It is the API (§2) or billing (§1). Go there, not to §4.
- now working → it really is the package + SHA entry. Fix that one row and put the restriction back.

**Testing a client key with `curl` is possible while restrictions are None**, and it is the fastest way to prove the key, project and billing are healthy — Google returns a specific `error_message` where the Android SDK gives only the generic block:

```bash
curl -s "https://maps.googleapis.com/maps/api/geocode/json?address=Galway,Ireland&key=$KEY"
```

A `200` with real results means key + project + billing are fine and the fault is confined to one API. (This is what isolated the 03/08/2026 staging outage: Geocoding on the client key returned Galway correctly while the map was still black, which ruled out everything except Maps SDK for Android being disabled.)

### Getting the Play App Signing SHA-1 without Play Console

The installed store build _is_ the Play-signed artifact, so its certificate can be read straight off the device — faster than the console and immune to picking the wrong block:

```bash
adb shell pm path com.ceolx.app.staging          # note the base.apk path
adb pull <base.apk path> /tmp/app.apk
~/Library/Android/sdk/build-tools/36.0.0/apksigner verify --print-certs /tmp/app.apk
```

Use **Signer #1**. Ignore the "Source Stamp Signer" lines — that is Play's provenance stamp, a different certificate, and registering it fails silently. `CN=Android, O=Google Inc.` on Signer #1 confirms Play re-signed it, i.e. this is the App Signing cert and not your upload key.

---

## 6. Troubleshooting

| Symptom                                                                             | Cause                                                                     | Fix                                          |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------- |
| `403 PERMISSION_DENIED` "The caller does not have permission" from Places           | **Places API (New)** not enabled, or not in the key's API allowlist       | §2, then re-check the key's API restrictions |
| `REQUEST_DENIED` "You must enable Billing"                                          | No active billing account on the key's project                            | §1                                           |
| Server returns `upstream_error`                                                     | Any upstream failure; Google's real body is logged                        | Vercel → Logs → search `places responded`    |
| Server returns `not_configured` (503)                                               | `GOOGLE_MAPS_API_KEY` unset in that environment                           | §3                                           |
| Blank map, `Authorization failure` in logcat                                        | **Ambiguous — do not assume SHA.** Bisect with §5 before touching §4      | §5 bisect → then §2 / §1 / §4                |
| Blank map, still failing with Application restrictions set to **None**              | **Maps SDK for Android not enabled on the project**, or billing           | §2 first, then §1                            |
| Blank/grey map on a **store** build, and §5's bisect points at the certificate      | Play App Signing SHA-1 not registered                                     | §4                                           |
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

| Purpose                            | Project / account                                 | Notes                                                                                                                                                                                      |
| ---------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Server (Places + Geocoding)        | `ceolxmusic@gmail.com`, billing enabled           | Rotated 28/07/2026. **Still unrestricted — needs §3 restrictions + quota cap.**                                                                                                            |
| Client (Maps SDK) — **staging**    | **`CeolXApp`** (`project-0e899904-a694-41ca-b3b`) | Key "Maps Platform API Key", created 28/07/2026 18:17. Billing account `0154DD-9F6BDC-C1040C` ("My Billing Account"), **free trial — €256.52 credit, ends 24/08/2026**. See warning below. |
| Client (Maps SDK) — **production** | **Unconfirmed** — a different, older project      | Key in `eas.json` since 16/06/2026 (`786553f`), so it predates `CeolXApp` and cannot be in it. Unaffected by the 03/08 staging incident. **Still needs its owning project recorded.**      |
| FCM (`google-services.json`)       | `ceolx-22bf1` (Spark)                             | Unrelated to Maps. Spark is fine for FCM.                                                                                                                                                  |

> ⚠️ **`CeolXApp` is on a Google Cloud free trial that ends 24/08/2026.** It backs the staging client key today. Per the rule above, a client key cannot be rotated without a native rebuild **and a store release** — so if that trial lapses while anything user-facing depends on it, the fix is days, not minutes. Attach a real billing account well before that date. Founder-level decision (spend).

### Incident log — 03/08/2026, staging Android map blank

**Cause:** `Maps SDK for Android` was never enabled on `CeolXApp`. The key was created there on 28/07 during key-hygiene work with the HTTP APIs enabled but not the SDK; the 30/07 staging binary (versionCode 10) baked it in. Android staging maps were therefore broken from **30/07 until 03/08 18:54** — unnoticed, because nobody opened the staging Android map in that window while the team was on the 1.0.13 production release.

**Fix:** enable Maps SDK for Android on `CeolXApp`. Google-side only — no rebuild, no OTA, no store release.

**Why it took an hour:** the SDK's generic error names a fingerprint and package, so the whole team (and the previous version of this page) read it as a SHA problem. It was not. Registering the correct Play App Signing SHA changed nothing, and neither did removing restrictions entirely. §5's bisect would have ruled the certificate out in five minutes.

**Verified staging values**, confirmed from three independent sources (logcat, `apksigner` on the installed APK, and the live `assetlinks.json`) — use these when restrictions are re-applied:

| Package                 | SHA-1                                                         |
| ----------------------- | ------------------------------------------------------------- |
| `com.ceolx.app.staging` | `FB:0C:9E:28:7D:0E:81:D0:47:5F:34:60:1B:2F:89:17:99:35:DA:4E` |

**Open — staging key deliberately left unrestricted (03/08/2026).** Application restrictions were set to **None** during diagnosis and, by decision, stay that way for now: the restriction was never the fault, and re-applying it on the evening of a release adds a fail-closed change for no benefit. Accepted, with eyes open:

- The key ships inside a public APK, so an unrestricted key can be scraped and billed against `CeolXApp` — whose trial holds €256.52 until 24/08/2026. **Compensating control: set a daily quota cap** on Maps SDK for Android (`APIs & Services → Quotas`), same as §3 prescribes for the server key. That bounds the damage to a known number and is worth doing even before the restriction goes back.
- Staging only. The production key is in a different project and is untouched.
- When re-applying, use the verified row above and re-read the fail-closed warning in §4 — every entry in one save, device in hand.
