#!/usr/bin/env node
/* global console, process */
// Pre-flight for a mobile release. For each shippable environment, prebuilds
// the native app and asks `eas fingerprint:compare` whether the resulting
// fingerprint matches the latest binary for that profile. Exits 0 when every
// environment is OTA-safe, 1 when any needs a new native build.
//
// Run from repo root. Assumes the developer is logged into EAS (`eas login`).

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const RESET = '\x1b[0m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';

// Each entry maps a human label → (APP_VARIANT value for app.config.js, EAS
// environment name passed to `eas fingerprint:compare --environment`, and the
// build profile used to resolve the latest binary). Staging binaries build
// under the `staging` profile but live in the `preview` EAS environment, hence
// the label/easEnv split. `development` is a dev-client tier (no store binary,
// no OTA gate) so it is intentionally omitted.
const ENVIRONMENTS = [
  {
    label: 'staging',
    appVariant: 'staging',
    easEnv: 'preview',
    compareProfile: 'staging',
  },
  {
    label: 'production',
    appVariant: 'production',
    easEnv: 'production',
    compareProfile: 'production',
    // Analytics is production-only by decision (30/07/2026), so a missing key
    // blocks a production release but is expected — and reported as fine — for
    // staging. Flip this on staging only if that decision changes.
    requiresAnalytics: true,
  },
];

const ANALYTICS_KEY = 'EXPO_PUBLIC_POSTHOG_KEY';

const MOBILE_DIR = path.join(process.cwd(), 'apps', 'native');

function die(msg) {
  console.error(`${RED}error: ${msg}${RESET}`);
  process.exit(1);
}

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { encoding: 'utf8', ...opts });
}

function ensureRepoRoot() {
  // CeolX's root package.json uses the `workspaces` field (not
  // pnpm-workspace.yaml), so detect the root via turbo.json + apps/native.
  if (!existsSync(path.join(process.cwd(), 'turbo.json')) || !existsSync(MOBILE_DIR)) {
    die(`must be run from the repo root (current: ${process.cwd()})`);
  }
}

function ensureCleanWorktree() {
  const r = run('git', ['status', '--porcelain']);
  if (r.status !== 0) die('git status failed');
  if (r.stdout.trim().length > 0) {
    die('working tree has uncommitted changes — commit or stash before running release-check');
  }
}

function prebuild(appVariant) {
  process.stdout.write(`  prebuilding (APP_VARIANT=${appVariant})… `);
  const r = run('npx', ['expo', 'prebuild', '--no-install', '--platform', 'all'], {
    cwd: MOBILE_DIR,
    env: { ...process.env, APP_VARIANT: appVariant },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (r.status !== 0) {
    console.log(`${RED}failed${RESET}`);
    process.stderr.write(r.stdout || '');
    process.stderr.write(r.stderr || '');
    return false;
  }
  console.log(`${GREEN}done${RESET}`);
  return true;
}

function compareFingerprint(appVariant, easEnv, compareProfile) {
  // `eas fingerprint:compare --environment <env>` alone exits with
  // "Insufficient arguments" in non-interactive mode — it needs an explicit
  // comparison target. Resolve the most recent finished binary for the build
  // profile, then pass its id via --build-id.
  process.stdout.write(`  resolving latest ${compareProfile} binary… `);
  const list = run(
    'eas',
    [
      'build:list',
      '--build-profile',
      compareProfile,
      '--status',
      'finished',
      '--limit',
      '1',
      '--json',
      '--non-interactive',
    ],
    { cwd: MOBILE_DIR, stdio: ['ignore', 'pipe', 'pipe'] }
  );
  const builds = list.status === 0 ? JSON.parse(list.stdout || '[]') : [];
  const buildId = builds[0]?.id;
  if (!buildId) {
    console.log(`${RED}none found${RESET}`);
    return {
      matched: false,
      stdout: '',
      stderr:
        list.stderr?.trim() ||
        `no finished ${compareProfile} binary exists yet — run the Mobile Staging/Production Build first`,
    };
  }
  console.log(`${DIM}${buildId}${RESET}`);
  process.stdout.write(`  comparing fingerprint… `);
  const r = run(
    'eas',
    ['fingerprint:compare', '--build-id', buildId, '--environment', easEnv, '--non-interactive'],
    {
      cwd: MOBILE_DIR,
      env: { ...process.env, APP_VARIANT: appVariant },
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
  return {
    matched: r.status === 0,
    stdout: r.stdout || '',
    stderr: r.stderr || '',
  };
}

/**
 * Whether the PostHog key will reach this environment's build.
 *
 * A release build with no key ships with analytics silently disabled: every event
 * is a no-op, and lib/analytics.ts only warns when __DEV__ is true, which a release
 * build never is. So the first symptom is an empty dashboard, discovered long after
 * the launch window it was meant to measure.
 *
 * The key can arrive from eas.json's build profile or from the EAS environment, so
 * both are checked. `unknown` (eas unreachable, not logged in) warns instead of
 * blocking — the fingerprint comparison is still worth running offline.
 */
function checkAnalyticsKey(buildProfile, easEnv) {
  const easJsonPath = path.join(MOBILE_DIR, 'eas.json');
  if (existsSync(easJsonPath)) {
    try {
      const cfg = JSON.parse(readFileSync(easJsonPath, 'utf8'));
      if (cfg.build?.[buildProfile]?.env?.[ANALYTICS_KEY]) return 'present';
    } catch {
      // A malformed eas.json will fail the fingerprint step with a better message.
    }
  }
  const r = run('npx', ['eas', 'env:list', '--environment', easEnv, '--non-interactive'], {
    cwd: MOBILE_DIR,
  });
  if (r.status !== 0) return 'unknown';
  return (r.stdout || '').includes(ANALYTICS_KEY) ? 'present' : 'missing';
}

function printSummary(results) {
  const matches = results.filter((r) => r.status === 'match');
  const mismatches = results.filter((r) => r.status === 'mismatch');
  const failures = results.filter((r) => r.status === 'prebuild_failed');
  const noAnalytics = results.filter((r) => r.analytics === 'missing' && r.env.requiresAnalytics);

  console.log(`${BOLD}summary${RESET}`);

  if (mismatches.length === 0 && failures.length === 0 && noAnalytics.length === 0) {
    console.log(`  ${GREEN}all ${matches.length} environments OTA-safe${RESET}`);
    console.log();
    console.log(
      `next: push to staging/main to publish the OTA (or ${BOLD}pnpm release${RESET} to bump the version first).`
    );
    return 0;
  }

  if (mismatches.length > 0) {
    const labels = mismatches.map((r) => r.env.label).join(', ');
    console.log(`  ${RED}new binary required: ${labels}${RESET}`);
  }
  if (failures.length > 0) {
    const labels = failures.map((r) => r.env.label).join(', ');
    console.log(`  ${YELLOW}prebuild failed: ${labels}${RESET}`);
  }
  if (noAnalytics.length > 0) {
    const labels = noAnalytics.map((r) => r.env.label).join(', ');
    console.log(`  ${RED}${ANALYTICS_KEY} missing: ${labels}${RESET}`);
    console.log(
      `  ${DIM}set it in eas.json's build profile or the EAS environment, else events silently no-op${RESET}`
    );
  }
  console.log();
  console.log(`next:`);
  console.log(`  1. trigger a binary build manually from the Actions tab:`);
  console.log(`     ${BOLD}gh workflow run mobile-staging.yml${RESET}    ${DIM}# staging${RESET}`);
  console.log(
    `     ${BOLD}gh workflow run mobile-production.yml${RESET} ${DIM}# production${RESET}`
  );
  console.log(`  2. install the new build on test devices.`);
  console.log(`  3. re-run ${BOLD}pnpm mobile:release-check${RESET} — should report OTA-safe.`);
  console.log(`  4. then push to staging/main (or ${BOLD}pnpm release${RESET}).`);
  return 1;
}

function main() {
  ensureRepoRoot();
  ensureCleanWorktree();

  console.log(`${BOLD}mobile release-check${RESET}`);
  console.log(
    `${DIM}compares the current source-tree fingerprint against the latest EAS binary per environment${RESET}`
  );
  console.log();

  const results = [];
  for (const env of ENVIRONMENTS) {
    console.log(`${BOLD}[${env.label}]${RESET}`);
    if (!prebuild(env.appVariant)) {
      results.push({ env, status: 'prebuild_failed' });
      console.log();
      continue;
    }
    const cmp = compareFingerprint(env.appVariant, env.easEnv, env.compareProfile);
    if (cmp.matched) {
      console.log(`${GREEN}✓ OTA-safe${RESET}`);
    } else {
      console.log(`${RED}✗ new binary required${RESET}`);
      const detail = (cmp.stdout + cmp.stderr).trim();
      if (detail) console.log(`${DIM}${detail}${RESET}`);
    }
    const analytics = checkAnalyticsKey(env.compareProfile, env.easEnv);
    if (analytics === 'missing' && env.requiresAnalytics) {
      console.log(`${RED}✗ ${ANALYTICS_KEY} not set — analytics would ship disabled${RESET}`);
    } else if (analytics === 'unknown') {
      console.log(`${YELLOW}? ${ANALYTICS_KEY} unverified (eas login?)${RESET}`);
    } else if (analytics === 'present') {
      console.log(`${GREEN}✓ ${ANALYTICS_KEY} set${RESET}`);
    } else {
      console.log(
        `${DIM}· ${ANALYTICS_KEY} unset (expected — analytics is production-only)${RESET}`
      );
    }

    results.push({ env, status: cmp.matched ? 'match' : 'mismatch', analytics });
    console.log();
  }

  process.exit(printSummary(results));
}

main();
