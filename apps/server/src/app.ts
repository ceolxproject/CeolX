import './instrumentation'; // Must be first — Sentry/OpenTelemetry instrumentations must register before application modules load

import { trpcServer } from '@hono/trpc-server';
import * as Sentry from '@sentry/node';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

import { createContext } from '@CeolX/api/context';
import { ensureEventsCollection } from '@CeolX/api/lib/typesense-collections';
import { appRouter } from '@CeolX/api/routers/index';
import { auth } from '@CeolX/auth';
import { rateLimiter, RATE_LIMIT_TIERS } from '@CeolX/cache';
import '@CeolX/env/server'; // validates required env vars at startup

import { isAllowedOrigin } from './config/cors';
import { publishJob } from './jobs/publish';
import { errorHandler } from './middleware/errorHandler';
import locationRoutes from './routes/location';
import resetPasswordRoute from './routes/reset-password';
import verifyEmailRoute from './routes/verify-email';
import webhooksRoutes from './routes/webhooks';
import { dispatchNotification } from './services/notifications-dispatcher';

// Inline scheduler for the M11-T1 30-day account-anonymise job.
// publishJob is server-only (depends on QStash + env), so we inject it
// through ctx instead of letting packages/api depend on apps/server.
const scheduleAccountAnonymize = async ({
  userId,
  requestedAt,
}: {
  userId: string;
  requestedAt: Date;
}) => {
  await publishJob(
    'account.anonymize',
    { userId, requestedAt: requestedAt.toISOString() },
    { delay: '30d' }
  );
};

export function buildApp() {
  const app = new Hono();

  app.use(logger());
  app.use(
    '/*',
    cors({
      origin: (origin) => {
        // No Origin header = native mobile or same-origin — allow (no CORS headers needed)
        if (!origin) return null;
        if (isAllowedOrigin(origin)) return origin;
        // Log rejected origins at warn level (not error — common from scanners)
        console.warn('[CORS] Rejected origin:', origin);
        return null; // Hono treats null as "deny"
      },
      credentials: true,
      allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
      exposeHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
      maxAge: 86400,
    })
  );

  // Health check — no rate limit, no auth required
  app.get('/health', (c) =>
    c.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    })
  );

  // BetterAuth — sign-up, sign-in, sign-out, email verification, OAuth callbacks
  app.use('/api/auth/*', rateLimiter(RATE_LIMIT_TIERS.authLogin));
  app.on(['POST', 'GET'], '/api/auth/*', (c) => auth.handler(c.req.raw));

  // HTTPS bridges for transactional-email buttons — email clients drop
  // ceolx:// hrefs, so these pages return an HTML auto-redirect into the app.
  app.route('/', verifyEmailRoute);
  app.route('/', resetPasswordRoute);

  // tRPC — all feature procedures (events, artists, bookings, admin) live in packages/api
  app.use('/trpc/*', rateLimiter(RATE_LIMIT_TIERS.authenticatedGeneral));
  app.use(
    '/trpc/*',
    trpcServer({
      router: appRouter,
      createContext: (_opts, context) =>
        createContext({ context, dispatchNotification, scheduleAccountAnonymize }),
      onError: ({ error, path }) => {
        if (error.code === 'INTERNAL_SERVER_ERROR') {
          Sentry.captureException(error, {
            extra: { trpcPath: path },
          });
          console.error('[tRPC Error]', {
            path,
            message: error.message,
            cause: error.cause,
            stack: error.stack,
          });
        }
      },
    })
  );

  // IP geolocation proxy — server-side lookup, no auth required
  app.use('/location/*', rateLimiter(RATE_LIMIT_TIERS.locationLookup));
  app.route('/location', locationRoutes);

  // Stripe webhook — raw body required, cannot go through tRPC (wired in M8-T2)
  app.route('/api/webhooks', webhooksRoutes);

  app.onError(errorHandler);
  app.notFound((c) =>
    c.json(
      {
        error: 'NotFound',
        code: 'ROUTE_NOT_FOUND',
        message: 'Endpoint not found',
        statusCode: 404,
      },
      404
    )
  );

  return app;
}

export const app = buildApp();

// Ensure the Typesense `events` collection exists once per server instance.
// Fire-and-forget and idempotent (no-op when the collection is already there),
// so a freshly provisioned or swapped Typesense cluster self-heals on the first
// cold start instead of requiring a manual collection-create. Failures are
// logged, never thrown — a Typesense hiccup must not stop the app from booting.
// Skipped under test (no real Typesense, and tests import this module).
if (process.env.NODE_ENV !== 'test') {
  void ensureEventsCollection().catch((err: unknown) => {
    console.warn(
      '[startup] ensureEventsCollection failed — events search may be unavailable until a resync:',
      err instanceof Error ? `${err.name}: ${err.message}` : err
    );
  });
}
