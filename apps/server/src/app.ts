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
import { errorHandler } from './middleware/errorHandler';
import appLinksRoute from './routes/app-links';
import appRedirectRoute from './routes/app-redirect';
import eventShareRoute from './routes/event-share';
import inviteShareRoute from './routes/invite-share';
import locationRoutes from './routes/location';
import postShareRoute from './routes/post-share';
import resetPasswordRoute from './routes/reset-password';
import verifyEmailRoute from './routes/verify-email';
import webhooksRoutes from './routes/webhooks';
import { dispatchNotification } from './services/notifications-dispatcher';

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
  // Tokenless redirect bridge (/r?to=<route>) for notification email CTAs.
  app.route('/', appRedirectRoute);

  // App Links / Universal Links ownership files + the shared-post and
  // shared-event web fallbacks. ceolx.ie (admin) rewrites /.well-known/*,
  // /post/*, and /event/* here. No auth, no rate limit — these are public and
  // hit by OS verifiers + social crawlers.
  app.route('/', appLinksRoute);
  app.route('/', postShareRoute);
  app.route('/', eventShareRoute);
  app.route('/', inviteShareRoute);

  // tRPC — all feature procedures (events, artists, bookings, admin) live in packages/api
  app.use('/trpc/*', rateLimiter(RATE_LIMIT_TIERS.authenticatedGeneral));
  app.use(
    '/trpc/*',
    trpcServer({
      router: appRouter,
      createContext: (_opts, context) => createContext({ context, dispatchNotification }),
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
