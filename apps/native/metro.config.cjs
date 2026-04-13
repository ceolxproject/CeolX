/* eslint-disable @typescript-eslint/no-require-imports */
const { getDefaultConfig } = require('expo/metro-config');
const { withSentryConfig } = require('@sentry/react-native/metro');
const { withUniwindConfig } = require('uniwind/metro');
const { wrapWithReanimatedMetroConfig } = require('react-native-reanimated/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// TypeScript ESM packages (e.g. packages/shared) use `.js` extensions in their
// import paths as required by the TS compiler. Metro resolves imports literally
// and can't find the `.js` files (which don't exist — only `.ts` does). This
// resolver retries with the `.ts` / `.tsx` extension when a `.js` import fails.
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  try {
    return (defaultResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
  } catch (error) {
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

// withSentryConfig enables automatic debug ID injection and source map handling
// for accurate crash reports in the Sentry ceolx-mobile project.
module.exports = withSentryConfig(uniwindConfig);
