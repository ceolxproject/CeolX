import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.resolve(here, '..', 'app.config.ts');

type AppConfigShape = {
  name: string;
  ios: { bundleIdentifier: string };
  android: { package: string };
  extra: { appVariant: string };
};

function loadConfig(variant: 'staging' | 'production'): AppConfigShape {
  const stdout = execFileSync(
    'tsx',
    [
      '-e',
      `import(${JSON.stringify(configPath)}).then((m) => process.stdout.write(JSON.stringify(m.default({ config: {} }))));`,
    ],
    {
      env: { ...process.env, APP_VARIANT: variant },
      encoding: 'utf8',
    }
  );
  return JSON.parse(stdout) as AppConfigShape;
}

const staging = loadConfig('staging');
assert.equal(staging.android.package, 'ie.ceolx.app.staging');
assert.equal(staging.ios.bundleIdentifier, 'ie.ceolx.app.staging');
assert.equal(staging.name, 'CeolX (Staging)');
assert.equal(staging.extra.appVariant, 'staging');

const prod = loadConfig('production');
assert.equal(prod.android.package, 'ie.ceolx.app');
assert.equal(prod.ios.bundleIdentifier, 'ie.ceolx.app');
assert.equal(prod.name, 'CeolX');
assert.equal(prod.extra.appVariant, 'production');

// eslint-disable-next-line no-console
console.log('app.config.ts: both variants verified ✓');
