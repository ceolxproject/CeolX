/* eslint-disable no-undef */
// Customizes which inputs `@expo/fingerprint` hashes when computing the
// `runtimeVersion` for OTA builds and updates. See:
//   https://docs.expo.dev/versions/latest/sdk/fingerprint
//
// MUST be `.cjs`, not `.js`: apps/native/package.json is `"type": "module"`, so
// a `.js` file here is ESM, and @expo/fingerprint loads this config with a plain
// `require()` — which throws ERR_REQUIRE_ESM. That error is swallowed (config
// silently becomes `{}`), so the sourceSkips below would never apply and every
// release would drift the fingerprint. `.cjs` is always CommonJS, so require works.
//
// Why we skip these:
//
// - `ExpoConfigVersions`: excludes `expo.version`, `expo.android.versionCode`,
//   and `expo.ios.buildNumber` from the hash. Without this, every `pnpm release`
//   shifts the fingerprint (because `app.config.js` reads `version` from
//   `apps/native/package.json` and `eas.json` auto-increments versionCode/
//   buildNumber on each build), orphaning every binary in the field from future
//   OTAs on each release. These fields are marketing / store-listing values, not
//   native-ABI changes — they don't affect whether a JS bundle can execute on an
//   existing binary.
//
// - `ExpoConfigRuntimeVersionIfString`: skip the `runtimeVersion` field itself
//   when it's a literal string. We use `{ policy: 'fingerprint' }`, not a string,
//   so this is defensive. Recommended by the docs as part of the standard
//   sourceSkips set.
//
// - `PackageJsonAndroidAndIosScriptsIfNotContainRun`: skip android/ios entries in
//   `package.json scripts` unless they contain the word "run". Our entries are
//   `"android": "expo run:android"` and `"ios": "expo run:ios"` — both contain
//   "run", so they stay in the hash. Other scripts (lint, test, etc.) are not
//   native-ABI inputs and rightly get excluded.

/** @type {import('@expo/fingerprint').Config} */
const config = {
  sourceSkips: [
    'ExpoConfigVersions',
    'ExpoConfigRuntimeVersionIfString',
    'PackageJsonAndroidAndIosScriptsIfNotContainRun',
  ],
};

module.exports = config;
