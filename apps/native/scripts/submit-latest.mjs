#!/usr/bin/env node
/**
 * Submit the most recent finished EAS build for a given bundle identifier
 * to its store. `eas submit --latest` ignores the build profile and picks
 * the newest iOS/Android build of any kind — once a project has builds
 * for multiple variants, that grabs the wrong one. Filtering by bundle id
 * is unambiguous: staging and production each have their own
 * (com.ceolx.app{.staging,""}), so the right build is always the latest
 * with that app identifier.
 *
 * Usage:
 *   node apps/native/scripts/submit-latest.mjs <platform> <profile> <bundle-id>
 *
 * Example:
 *   node apps/native/scripts/submit-latest.mjs ios staging com.ceolx.app.staging
 */
import { spawnSync } from 'node:child_process';
import process from 'node:process';

const [platform, profile, bundleId] = process.argv.slice(2);

if (!platform || !profile || !bundleId) {
  process.stderr.write(
    'usage: submit-latest.mjs <ios|android> <eas-profile> <bundle-id>\n'
  );
  process.exit(1);
}

// app.config.js reads APP_VARIANT to resolve the bundle/app identifier. The
// staging submit profile in eas.json has no ascAppId, so EAS falls back to
// app.config — without APP_VARIANT set it defaults to "development" and targets
// the .dev identifier, mismatching a .staging IPA. Map profile → APP_VARIANT
// here so app.config resolves the right bundle on submit.
const PROFILE_TO_APP_VARIANT = {
  staging: 'staging',
  production: 'production',
};
const appVariant = PROFILE_TO_APP_VARIANT[profile];

const listing = spawnSync(
  'eas',
  [
    'build:list',
    '--platform',
    platform,
    '--app-identifier',
    bundleId,
    '--status',
    'finished',
    '--limit',
    '1',
    '--json',
    '--non-interactive',
  ],
  { encoding: 'utf8' }
);

if (listing.status !== 0) {
  process.stderr.write(listing.stderr ?? '');
  process.exit(listing.status ?? 1);
}

const builds = JSON.parse(listing.stdout);
const latest = builds[0];

if (!latest) {
  process.stderr.write(
    `No finished ${platform} builds found for bundle id ${bundleId}.\n`
  );
  process.exit(1);
}

process.stdout.write(
  `Submitting build ${latest.id} (v${latest.appVersion}, build ${latest.appBuildVersion}) for ${bundleId}\n`
);

const submit = spawnSync(
  'eas',
  ['submit', '--platform', platform, '--profile', profile, '--id', latest.id],
  {
    stdio: 'inherit',
    env: appVariant ? { ...process.env, APP_VARIANT: appVariant } : process.env,
  }
);

process.exit(submit.status ?? 0);
