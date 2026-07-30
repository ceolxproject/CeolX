import { Hono } from 'hono';

import { env } from '@CeolX/env/server';

/**
 * Serves the two static ownership files the mobile OSes fetch to verify that
 * this domain is allowed to open the CeolX app via an `https://ceolx.com/...`
 * link (rather than the browser):
 *
 *   GET /.well-known/apple-app-site-association   → iOS Universal Links
 *   GET /.well-known/assetlinks.json              → Android App Links
 *
 * `ceolx.com` (the share-link + associated-domain host) is the admin Vite app on
 * a separate Vercel project; its vercel.json rewrites `/.well-known/*` here so
 * Apple/Google fetch these from ceolx.com while the values stay env-driven in one
 * place. A rewrite (not a redirect) keeps the URL on ceolx.com, which Apple
 * requires — it refuses an AASA served via a 3xx hop.
 *
 * Both files MUST be valid JSON, 200, no redirect. The matching app-side config
 * lives in apps/native/app.config.js (`ios.associatedDomains` +
 * `android.intentFilters`). Paths are scoped to `/post/*` and `/event/*` — the
 * shared link shapes today (apps/native/hooks/use-share-post.ts and the event
 * share page). Widen both sides together if more deep-linkable web routes appear.
 */

// Bundle id / Android package this deployment vouches for. Prod default;
// the staging server sets MOBILE_BUNDLE_ID=com.ceolx.app.staging so its
// files match the staging app build (different bundle + signing keystore).
const BUNDLE_ID = env.MOBILE_BUNDLE_ID ?? 'com.ceolx.app';

// Public-by-design fallback so App Links work even if the env var is unset on a
// given deploy. Override per-environment via ANDROID_SHA256_CERT_FINGERPRINT.
// Source: `eas credentials` → Android → production keystore → SHA-256.
const PROD_ANDROID_SHA256 =
  '45:1A:3A:9D:98:E7:84:08:B0:7E:93:33:72:5E:CC:66:32:EC:BD:A5:71:2F:FF:57:25:8A:E1:0F:14:DC:C5:D6';

// Shared-link path scopes, kept identical on both platforms. Each shareable web
// route (apps/native/hooks/use-share-*.ts) needs its prefix listed here AND in
// the matching app.config.js intentFilters + admin vercel.json rewrite.
const LINK_PATH_GLOBS = ['/post/*', '/event/*', '/u/*'];

// Both files are fetched by Google/Apple verification crawlers on a tight
// deadline, and a cold start here once timed out → deadline_exceeded → App Links
// unverified. s-maxage keeps a warm copy on api.ceolx.com's edge so a cached PoP
// answers the crawler without invoking the function; stale-while-revalidate keeps
// answering from cache past expiry while refreshing behind the request. The first
// crawl per PoP after each deploy still cold-starts — this shrinks the window.
const WELL_KNOWN_CACHE_CONTROL =
  'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800';

const appLinks = new Hono();

// iOS Universal Links. The `appID` is `<App ID Prefix>.<bundle id>`; the prefix
// equals the Apple Team ID for normally-created App IDs (see APPLE_OAUTH_TEAM_ID
// in @CeolX/env). When the Team ID is unset we still return valid JSON with an
// empty `details` — universal links simply stay inactive rather than 500-ing
// Apple's verification crawl.
appLinks.get('/.well-known/apple-app-site-association', (c) => {
  const teamId = env.APPLE_OAUTH_TEAM_ID;
  const details = teamId
    ? [
        {
          appIDs: [`${teamId}.${BUNDLE_ID}`],
          components: LINK_PATH_GLOBS.map((glob) => ({
            '/': glob,
            comment: 'Shared CeolX links',
          })),
        },
      ]
    : [];

  c.header('Content-Type', 'application/json');
  c.header('Cache-Control', WELL_KNOWN_CACHE_CONTROL);
  return c.body(JSON.stringify({ applinks: { details } }));
});

// Android App Links. `sha256_cert_fingerprints` accepts multiple values, so a
// future staging/upload-key fingerprint can be appended without breaking prod.
appLinks.get('/.well-known/assetlinks.json', (c) => {
  const sha256 = env.ANDROID_SHA256_CERT_FINGERPRINT ?? PROD_ANDROID_SHA256;

  const statements = [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: BUNDLE_ID,
        sha256_cert_fingerprints: [sha256],
      },
    },
  ];

  c.header('Content-Type', 'application/json');
  c.header('Cache-Control', WELL_KNOWN_CACHE_CONTROL);
  return c.body(JSON.stringify(statements));
});

export default appLinks;
