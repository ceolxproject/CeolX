/* eslint-disable @typescript-eslint/no-require-imports */
const { getDefaultConfig } = require('expo/metro-config');
const { withSentryConfig } = require('@sentry/react-native/metro');
const { withUniwindConfig } = require('uniwind/metro');
const { wrapWithReanimatedMetroConfig } = require('react-native-reanimated/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

const uniwindConfig = withUniwindConfig(wrapWithReanimatedMetroConfig(config), {
  cssEntryFile: './global.css',
  dtsFile: './uniwind-types.d.ts',
});

// withSentryConfig enables automatic debug ID injection and source map handling
// for accurate crash reports in the Sentry ceolx-mobile project.
module.exports = withSentryConfig(uniwindConfig);
