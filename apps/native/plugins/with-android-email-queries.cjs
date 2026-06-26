const { withAndroidManifest } = require('expo/config-plugins');

// Mirror of ANDROID_EMAIL_PACKAGES in utils/open-email-app.ts. Android 11+
// package visibility hides these from getLaunchIntentForPackage (used by
// IntentLauncher.openApplication) unless they're declared in <queries>, so the
// direct-launch fallback would silently fail without this. Keep both lists in sync.
const EMAIL_PACKAGES = [
  'com.google.android.gm', // Gmail
  'com.microsoft.office.outlook', // Outlook
  'com.samsung.android.email.provider', // Samsung Email
  'com.yahoo.mobile.client.android.mail', // Yahoo Mail
  'ch.protonmail.android', // Proton Mail
  'com.fsck.k9', // K-9 Mail
  'me.bluemail.mail', // BlueMail
];

/**
 * Adds <queries><package> entries for common email apps so the "Open Email App"
 * button on the verify-email screen can launch them directly when the device
 * has no app declaring CATEGORY_APP_EMAIL (Asana 1215960893303593).
 */
const withAndroidEmailQueries = (config) =>
  withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest.queries = manifest.queries ?? [];

    // Reuse a single <queries> block; find or create one.
    const queries = manifest.queries[0] ?? {};
    if (!manifest.queries.length) manifest.queries.push(queries);
    queries.package = queries.package ?? [];

    const existing = new Set(queries.package.map((p) => p.$['android:name']));
    for (const name of EMAIL_PACKAGES) {
      if (!existing.has(name)) {
        queries.package.push({ $: { 'android:name': name } });
      }
    }

    return cfg;
  });

module.exports = withAndroidEmailQueries;
