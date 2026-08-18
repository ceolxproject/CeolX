import 'dotenv/config';
import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    CORS_ALLOWED_ORIGINS: z.string().min(1),
    NODE_ENV: z.enum(['development', 'production', 'staging']).catch('development'),
    POSTMARK_API_TOKEN: z.string().optional(),
    POSTMARK_FROM_ADDRESS: z.string().default('noreply@ceolx.com'),
    SMTP_HOST: z.string().default('localhost'),
    SMTP_PORT: z.coerce.number().default(1025),
    UPSTASH_REDIS_REST_URL: z.string().url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
    RATE_LIMIT_ENABLED: z.enum(['true', 'false']).default('true'),
    RATE_LIMIT_IP_ALLOWLIST: z.string().optional(),
    GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
    GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional(),
    // Native Google Sign-In client ids. The idToken the mobile SDK mints carries
    // the **web** client id (GOOGLE_OAUTH_CLIENT_ID) as its audience, so that one
    // alone usually verifies — but listing the iOS/Android clients too makes the
    // server accept tokens minted with either as the audience. Optional.
    GOOGLE_OAUTH_IOS_CLIENT_ID: z.string().optional(),
    GOOGLE_OAUTH_ANDROID_CLIENT_ID: z.string().optional(),
    // Google Geocoding API key — server-side only. The app's geocoding search
    // (LocationPicker) proxies through /location/geocode so this key is never
    // shipped in the bundle and can be IP-restricted. NOT the same as the
    // Android Maps SDK key (which is app-restricted and rejected by the HTTP
    // Geocoding API). Optional so the server boots without it; the route then
    // returns a clear "geocoding not configured" error instead of crashing.
    GOOGLE_MAPS_API_KEY: z.string().optional(),
    APPLE_OAUTH_CLIENT_ID: z.string().optional(),
    // Apple Developer Team ID (10 chars). Reused as the App ID Prefix in the
    // Universal Links AASA file served at /.well-known/apple-app-site-association
    // (apps/server/src/routes/app-links.ts). For App IDs created the normal way
    // the prefix equals the Team ID; if yours differs, set the prefix here.
    APPLE_OAUTH_TEAM_ID: z.string().optional(),
    APPLE_OAUTH_KEY_ID: z.string().optional(),
    APPLE_OAUTH_PRIVATE_KEY: z.string().optional(),
    APPLE_APP_BUNDLE_IDENTIFIER: z.string().optional(),
    // Android release-keystore SHA-256 cert fingerprint (colon-separated upper
    // hex) published in /.well-known/assetlinks.json so the OS verifies App
    // Links for ceolx.com/post/* into the app. Source: `eas credentials` →
    // Android → production keystore → SHA-256. Public by design (it is served
    // to the world); the route falls back to the known prod value when unset.
    ANDROID_SHA256_CERT_FINGERPRINT: z.string().optional(),
    // Mobile bundle id / Android package this server's App Links files vouch
    // for. Prod is com.ceolx.app (the default); the STAGING server sets this to
    // com.ceolx.app.staging so its AASA/assetlinks match the staging app.
    MOBILE_BUNDLE_ID: z.string().optional(),
    // Canonical origin of shared-post links, used for og:url on the /post page.
    // Prod = https://ceolx.com; staging = the staging server's own Vercel URL.
    PUBLIC_WEB_ORIGIN: z.string().url().optional(),
    // Store URLs used by the shared-post web fallback page (/post/:id) when the
    // app is not installed. Optional — the route derives sensible defaults
    // (Play Store from the package id; App Store search until the numeric id is
    // known). Set IOS_APP_STORE_URL to the real listing once the app is live.
    IOS_APP_STORE_URL: z.string().url().optional(),
    ANDROID_PLAY_STORE_URL: z.string().url().optional(),
    SENTRY_DSN_API: z.url().optional(),
    SENTRY_ENVIRONMENT: z.string().optional(),
    QSTASH_TOKEN: z.string().optional(),
    QSTASH_CURRENT_SIGNING_KEY: z.string().optional(),
    QSTASH_NEXT_SIGNING_KEY: z.string().optional(),
    QSTASH_BASE_URL: z.string().url().optional(),
    TYPESENSE_HOST: z.string().min(1),
    TYPESENSE_API_KEY: z.string().min(1),
    TYPESENSE_PORT: z.coerce.number().default(443),
    TYPESENSE_PROTOCOL: z.enum(['http', 'https']).default('https'),
    AWS_REGION: z.string().optional(),
    AWS_ACCESS_KEY_ID: z.string().optional(),
    AWS_SECRET_ACCESS_KEY: z.string().optional(),
    S3_BUCKET_NAME: z.string().optional(),
    CLOUDFRONT_DOMAIN: z.string().optional(),
    // Mux — used by uploads router (Direct Upload) + /api/webhooks/mux.
    // Optional so the server boots in dev/test without Mux configured;
    // upload calls throw PRECONDITION_FAILED with a clear message instead.
    MUX_TOKEN_ID: z.string().optional(),
    MUX_TOKEN_SECRET: z.string().optional(),
    MUX_WEBHOOK_SECRET: z.string().optional(),
    // Stripe — venue subscriptions (M8). Optional for the same reason as Mux
    // above: the server, the admin app and every test suite must boot without
    // billing configured. getStripeClient() throws PRECONDITION_FAILED naming
    // the missing variable on first use, so a misconfiguration surfaces loudly
    // at the call site instead of silently half-working.
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    // One product, two billing intervals (M8-T0 D-04). Both Prices must be
    // created with tax_behavior: 'inclusive' (D-61) — Stripe will not let that
    // be changed afterwards, so a mistake means new Prices and migrating live
    // subscriptions.
    STRIPE_PRICE_MONTHLY: z.string().optional(),
    STRIPE_PRICE_ANNUAL: z.string().optional(),
    // Free-trial length in days (D-05/D-06). Configurable so the client can
    // change it without a deploy; it applies to new checkouts only and never
    // shortens or extends a trial already running.
    STRIPE_TRIAL_DAYS: z.coerce.number().int().positive().default(183),
    // Days a failed payment keeps the profile visible before it is hidden
    // (D-33). Zero is a legitimate setting if the client prefers strictness,
    // hence nonnegative rather than positive.
    // One-time activation link lifetime (D-17 fixes the window at 30–60 min).
    ACTIVATION_TOKEN_TTL_MINUTES: z.coerce.number().int().min(30).max(60).default(45),
    // Venue visibility kill switch (M8-T0 O-08). Defaults to 'false' so merging
    // the restored gate is inert: every venue in production is still `inactive`,
    // and enabling this before the back-fill runs would hide all of them at
    // once — while the app has been promising them advance notice.
    VENUE_GATE_ENABLED: z.enum(['true', 'false']).default('false'),
    // Firebase Cloud Messaging — used by apps/server/src/lib/firebase-admin
    // and the notification.push QStash handler. Optional so the server boots
    // in dev/test without push set up; getMessaging() throws on first use.
    FIREBASE_PROJECT_ID: z.string().optional(),
    FIREBASE_SERVICE_ACCOUNT_KEY: z.string().optional(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
