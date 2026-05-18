// Custom standard-version updater that keeps the hardcoded `version: '<x.y.z>'`
// in apps/native/app.config.js synced with apps/native/package.json.
//
// app.config.js holds the version literally so EAS and local node evaluate
// byte-identical config (otherwise the runtimeVersion fingerprint drifts).
// Standard-version invokes readVersion/writeVersion on every release bump.

const VERSION_RE = /^(\s*version:\s*')([^']+)(')/m;

function readVersion(contents) {
  const match = contents.match(VERSION_RE);
  if (!match) {
    throw new Error(
      "standard-version updater: couldn't find a top-level `version: '...'` line in app.config.js"
    );
  }
  return match[2];
}

function writeVersion(contents, version) {
  if (!VERSION_RE.test(contents)) {
    throw new Error(
      "standard-version updater: couldn't find a top-level `version: '...'` line in app.config.js"
    );
  }
  return contents.replace(VERSION_RE, `$1${version}$3`);
}

module.exports = { readVersion, writeVersion };
