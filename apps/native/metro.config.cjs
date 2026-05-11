/* eslint-disable @typescript-eslint/no-require-imports */
const { getDefaultConfig } = require('expo/metro-config');
const { withSentryConfig } = require('@sentry/react-native/metro');
const { withUniwindConfig } = require('uniwind/metro');
const { wrapWithReanimatedMetroConfig } = require('react-native-reanimated/metro-config');
const path = require('node:path');

// Pin Expo's notion of the Metro server root to the project (apps/native)
// _before_ getDefaultConfig reads it. By default Expo points serverRoot at the
// pnpm workspace root, which causes Metro 0.83's Server.js to compute the
// entry's originModulePath as `${workspaceRoot}/.`. TreeFS normalises that to
// `../../.` relative to the project root and the resulting hierarchical lookup
// trips the "Unexpectedly escaped traversal" invariant during
// `expo export:embed --eager`. Setting this env var keeps serverRoot ==
// projectRoot, but disables Expo's automatic monorepo watchFolders, so we
// reinstate those manually below.
process.env.EXPO_NO_METRO_WORKSPACE_ROOT = '1';

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
// Leave hierarchical lookup ENABLED. pnpm's isolated mode puts a package's
// peer/runtime deps inside its own `.pnpm/<hash>/node_modules/` directory
// (e.g. `whatwg-fetch` sits next to `@expo/metro-runtime` inside its isolated
// node_modules). Without the walk-up Metro can't find them.

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  try {
    return (defaultResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
  } catch (error) {
    // TypeScript ESM workspace packages (packages/shared etc.) use `.js`
    // extensions in their import paths as the TS compiler requires. Metro
    // resolves imports literally and can't find the `.js` files (only `.ts`
    // exists), so retry with the source extensions when the literal lookup fails.
    if (moduleName.endsWith('.js')) {
      const tsName = moduleName.slice(0, -3) + '.ts';
      try {
        return (defaultResolveRequest ?? context.resolveRequest)(context, tsName, platform);
      } catch {
        const tsxName = moduleName.slice(0, -3) + '.tsx';
        return (defaultResolveRequest ?? context.resolveRequest)(context, tsxName, platform);
      }
    }
    throw error;
  }
};

const uniwindConfig = withUniwindConfig(wrapWithReanimatedMetroConfig(config), {
  cssEntryFile: './global.css',
  dtsFile: './uniwind-types.d.ts',
});

// Sentry's metro serializer (@sentry/react-native 7.11) calls
// `bundleCode.match(...)` on the inner serializer's output. With
// `expo export:embed` on Metro 0.83 the output isn't the `{code, map}`
// shape Sentry expects and `bundleCode` is undefined, crashing the
// embed step. This affects BOTH the EAGER_BUNDLE phase (`--eager`)
// AND the Gradle `:app:createBundleReleaseJsAndAssets` task which
// invokes `expo export:embed` without `--eager` as a fallback. Skip
// the Sentry wrapper for any embed invocation — the dev server and
// `expo export` (web/standalone) still get debug-id injection.
const isEmbed = process.argv.some((arg) => arg === 'export:embed' || arg.endsWith('/export:embed'));

module.exports = isEmbed ? uniwindConfig : withSentryConfig(uniwindConfig);
