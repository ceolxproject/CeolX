import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const env = createEnv({
  clientPrefix: 'EXPO_PUBLIC_',
  client: {
    EXPO_PUBLIC_SERVER_URL: z.url(),
    EXPO_PUBLIC_SENTRY_DSN: z.url().optional(),
    // Origin the native Share sheet builds shared-post links against, and the
    // host iOS/Android verify Universal/App Links against. Prod is the marketing
    // domain (https://ceolx.com, which rewrites /post + /.well-known to the API);
    // staging has no custom domain, so it points straight at the staging server
    // Vercel URL (the Hono backend serves the page + .well-known itself). Must
    // match the host used in app.config.js's associatedDomains / intentFilters.
    EXPO_PUBLIC_SHARE_BASE_URL: z.url().optional(),
    // CloudFront CDN domain for media URLs. Optional in dev/test; required
    // in prod for delete-on-replace flows — use-media-delete derives the s3
    // key from a stored CDN url by stripping this domain.
    EXPO_PUBLIC_CLOUDFRONT_DOMAIN: z.string().optional(),
    // Google **Web** OAuth client id — the audience of the idToken the native
    // Google Sign-In SDK returns (configureGoogleSignIn). Optional so dev/Expo
    // Go builds without it still boot; native Google is disabled when unset.
    EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: z.string().optional(),
    // PostHog project API key. Optional — analytics is disabled entirely when
    // unset, so Expo Go and fresh clones boot without it.
    EXPO_PUBLIC_POSTHOG_KEY: z.string().optional(),
    // EU Cloud for GDPR (Irish client). Defaulted rather than required so a
    // missing value can never silently ship EU data to the US region.
    EXPO_PUBLIC_POSTHOG_HOST: z.url().default('https://eu.i.posthog.com'),
    // Session replay kill switch, separate from the key so analytics can ship
    // and be verified before replay is switched on. Masking is applied on-device
    // before upload and is NOT retroactive, so replay stays off until the
    // masking has been eyeballed on a non-production project.
    EXPO_PUBLIC_POSTHOG_REPLAY: z.enum(['true', 'false']).default('false'),
    // Local-only escape hatch. Analytics is off in __DEV__ so day-to-day dev
    // never pollutes the project, but that also makes it impossible to verify a
    // newly-wired event without a release build. Set this to 'true' in
    // .env.development.local (gitignored, machine-specific) to capture from a dev
    // client. Never set it in .env.staging / .env.production.
    EXPO_PUBLIC_POSTHOG_DEV_CAPTURE: z.enum(['true', 'false']).default('false'),
  },
  // Metro's babel-preset-expo only inlines static `process.env.EXPO_PUBLIC_*`
  // accesses at build time. `runtimeEnv: process.env` passes the whole object
  // and the library reads keys dynamically (`process.env[key]`), which babel
  // can't statically replace — so every value comes back as undefined in a
  // production bundle. List each variable explicitly so the bundler can inline.
  runtimeEnv: {
    EXPO_PUBLIC_SERVER_URL: process.env.EXPO_PUBLIC_SERVER_URL,
    EXPO_PUBLIC_SENTRY_DSN: process.env.EXPO_PUBLIC_SENTRY_DSN,
    EXPO_PUBLIC_SHARE_BASE_URL: process.env.EXPO_PUBLIC_SHARE_BASE_URL,
    EXPO_PUBLIC_CLOUDFRONT_DOMAIN: process.env.EXPO_PUBLIC_CLOUDFRONT_DOMAIN,
    EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    EXPO_PUBLIC_POSTHOG_KEY: process.env.EXPO_PUBLIC_POSTHOG_KEY,
    EXPO_PUBLIC_POSTHOG_HOST: process.env.EXPO_PUBLIC_POSTHOG_HOST,
    EXPO_PUBLIC_POSTHOG_REPLAY: process.env.EXPO_PUBLIC_POSTHOG_REPLAY,
    EXPO_PUBLIC_POSTHOG_DEV_CAPTURE: process.env.EXPO_PUBLIC_POSTHOG_DEV_CAPTURE,
  },
  emptyStringAsUndefined: true,
});
