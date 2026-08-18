import * as Sentry from '@sentry/node';

if (process.env.NODE_ENV !== 'development' && !process.env.SENTRY_DSN_API) {
  console.warn('[Sentry] SENTRY_DSN_API not set — error capture disabled');
}

/** Query parameters that are credentials, not diagnostics. */
const SENSITIVE_QUERY_PARAMS = ['token', 'code', 'secret'];

export function redactUrl(value: string): string {
  // Hand-rolled rather than `new URL()`: Sentry passes relative paths as well as
  // absolute URLs, and constructing URL on a relative path throws.
  let out = value;
  for (const key of SENSITIVE_QUERY_PARAMS) {
    out = out.replace(new RegExp(`([?&]${key}=)[^&#]*`, 'gi'), `$1[redacted]`);
  }
  return out;
}

function scrubSensitive<
  T extends { request?: { url?: string; query_string?: unknown }; transaction?: string },
>(event: T): T {
  if (event.request?.url) {
    event.request.url = redactUrl(event.request.url);
  }
  if (typeof event.request?.query_string === 'string') {
    event.request.query_string = redactUrl(event.request.query_string);
  }
  if (event.transaction) {
    event.transaction = redactUrl(event.transaction);
  }
  return event;
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
  // Strip single-use credentials out of anything Sentry stores.
  //
  // `app.ts` already keeps the activation token out of the access log, but Sentry
  // captures the full request URL on both errors and performance transactions — and
  // transactions are sampled at 10% in production, so a live token would land in a
  // third-party store on a request that did not even fail. That undoes the redaction
  // rather than complementing it.
  //
  // Applied to both hooks and to the transaction name, because the name is derived
  // from the URL and is stored separately from `request.url`.
  beforeSend: scrubSensitive,
  beforeSendTransaction: scrubSensitive,
});
