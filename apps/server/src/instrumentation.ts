import * as Sentry from '@sentry/node';

// Must be imported first in src/index.ts — before any other module — so Sentry
// can patch async context and capture errors from all downstream imports.
Sentry.init({
  dsn: process.env.SENTRY_DSN_API,
  environment: process.env.SENTRY_ENVIRONMENT ?? 'development',
  enabled: process.env.NODE_ENV !== 'development',
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  ignoreErrors: [
    // Expected client errors — not bugs, no action needed
    'ValidationError',
    'AuthenticationError',
  ],
});
