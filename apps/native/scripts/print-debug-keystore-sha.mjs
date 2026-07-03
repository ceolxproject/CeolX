#!/usr/bin/env node
/**
 * Print the SHA-1 / SHA-256 of the local Android debug keystore so the
 * fingerprint can be registered in Firebase Console for Google sign-in.
 * Gradle generates `android/app/debug.keystore` on the first `expo run:android`
 * with a per-machine key — Firebase needs its SHA-1 to issue Google id_tokens
 * for the dev package (com.ceolx.app.dev, the local default APP_VARIANT).
 *
 * Usage:
 *   pnpm -F native keystore:sha
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const keystorePath = path.resolve(here, '..', 'android', 'app', 'debug.keystore');

if (!existsSync(keystorePath)) {
  process.stderr.write(
    `debug.keystore not found at ${path.relative(process.cwd(), keystorePath)}\n` +
      'Run `pnpm -F native android` once to let Gradle generate it, then re-run this command.\n'
  );
  process.exit(1);
}

const result = spawnSync(
  'keytool',
  [
    '-list',
    '-v',
    '-keystore',
    keystorePath,
    '-alias',
    'androiddebugkey',
    '-storepass',
    'android',
    '-keypass',
    'android',
  ],
  { encoding: 'utf8' }
);

if (result.status !== 0) {
  process.stderr.write(result.stderr || 'keytool failed\n');
  process.exit(result.status ?? 1);
}

const sha1 = result.stdout.match(/SHA1:\s*([A-F0-9:]+)/)?.[1];
const sha256 = result.stdout.match(/SHA256:\s*([A-F0-9:]+)/)?.[1];

if (!sha1 || !sha256) {
  process.stderr.write('Could not parse SHA fingerprints from keytool output.\n');
  process.stderr.write(result.stdout);
  process.exit(1);
}

process.stdout.write(
  `Local debug keystore fingerprints (Firebase Console → com.ceolx.app.dev → Add fingerprint):\n\n` +
    `  SHA-1:   ${sha1}\n` +
    `  SHA-256: ${sha256}\n\n` +
    `After adding, re-download apps/native/google-services.development.json and rebuild.\n`
);
