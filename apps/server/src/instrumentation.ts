import * as Sentry from '@sentry/node';

if (process.env.NODE_ENV !== 'development' && !process.env.SENTRY_DSN_API) {
  console.warn('[Sentry] SENTRY_DSN_API not set — error capture disabled');
}

// Must be first — Sentry/OpenTelemetry instrumentations must register before application modules load
Sentry.init({
  dsn: process.env.SENTRY_DSN_API,
  environment: process.env.SENTRY_ENVIRONMENT ?? 'development',
  enabled: process.env.NODE_ENV !== 'development',
  tracesSampleRate:
    process.env.SENTRY_ENVIRONMENT === 'production'
      ? 0.1
      : process.env.SENTRY_ENVIRONMENT === 'staging'
        ? 0.2
        : 1.0,
  ignoreErrors: [
    // These match the `.name` property of error classes (not message text)
    'ZodError',
  ],
});
