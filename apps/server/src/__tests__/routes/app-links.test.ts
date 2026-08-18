import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { mockEnv } = vi.hoisted(() => ({
  mockEnv: {
    APPLE_OAUTH_TEAM_ID: undefined as string | undefined,
    ANDROID_SHA256_CERT_FINGERPRINT: undefined as string | undefined,
  },
}));

vi.mock('@CeolX/env/server', () => ({ env: mockEnv }));

import appLinksRoute from '../../routes/app-links.js';

interface Aasa {
  applinks: { details: { appIDs: string[]; components: { '/': string }[] }[] };
}
type AssetLinks = {
  relation: string[];
  target: { package_name: string; sha256_cert_fingerprints: string[] };
}[];

function buildApp() {
  const app = new Hono();
  app.route('/', appLinksRoute);
  return app;
}

afterEach(() => {
  mockEnv.APPLE_OAUTH_TEAM_ID = undefined;
  mockEnv.ANDROID_SHA256_CERT_FINGERPRINT = undefined;
});

describe('GET /.well-known/apple-app-site-association', () => {
  it('serves valid JSON with the appID built from the Team ID, scoped to /post/* and /event/*', async () => {
    mockEnv.APPLE_OAUTH_TEAM_ID = 'ABCDE12345';
    const res = await buildApp().request('/.well-known/apple-app-site-association');

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/application\/json/);
    // Asserted as a literal, not via the route's own constant — importing that
    // would test it against itself. Trimming s-maxage/SWR here regressed App
    // Links verification once; this is the guard.
    expect(res.headers.get('cache-control')).toBe(
      'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800'
    );

    const body = (await res.json()) as Aasa;
    const detail = body.applinks.details[0];
    expect(detail?.appIDs).toEqual(['ABCDE12345.com.ceolx.app']);
    const paths = detail?.components.map((comp) => comp['/']);
    expect(paths).toEqual(['/post/*', '/event/*', '/u/*']);
  });

  it('serves valid-but-empty JSON when the Team ID is unset (never 500s the crawler)', async () => {
    const res = await buildApp().request('/.well-known/apple-app-site-association');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Aasa;
    expect(body.applinks.details).toEqual([]);
  });
});

describe('GET /.well-known/assetlinks.json', () => {
  it('serves the package + SHA-256 statement as a JSON array', async () => {
    const res = await buildApp().request('/.well-known/assetlinks.json');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/application\/json/);
    expect(res.headers.get('cache-control')).toBe(
      'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800'
    );

    const body = (await res.json()) as AssetLinks;
    expect(Array.isArray(body)).toBe(true);
    expect(body[0]?.relation).toEqual(['delegate_permission/common.handle_all_urls']);
    expect(body[0]?.target.package_name).toBe('com.ceolx.app');
    expect(body[0]?.target.sha256_cert_fingerprints).toHaveLength(1);
  });

  it('prefers the env fingerprint over the baked-in fallback', async () => {
    mockEnv.ANDROID_SHA256_CERT_FINGERPRINT = 'AA:BB:CC';
    const body = (await (
      await buildApp().request('/.well-known/assetlinks.json')
    ).json()) as AssetLinks;
    expect(body[0]?.target.sha256_cert_fingerprints).toEqual(['AA:BB:CC']);
  });
});

describe('deep-link scope must never capture /activate (M8-T0 D-16, D-60)', () => {
  // The venue activation link has to open in a BROWSER so the venue can reach
  // Stripe Checkout. If it were ever captured as a universal/app link it would open
  // the app instead and silently break the only route into billing — and it would
  // fail quietly, because the email would still appear to work. The comments in
  // app-links.ts and app.config.js say so; this makes it fail the build instead.
  it('the iOS AASA components do not match /activate', async () => {
    // afterEach clears the Team ID, and without one the AASA serves an empty
    // `details` array — which would make every assertion below vacuously true.
    mockEnv.APPLE_OAUTH_TEAM_ID = 'TEAMID1234';

    const body = (await (
      await buildApp().request('/.well-known/apple-app-site-association')
    ).json()) as { applinks: { details: { components?: { '/': string }[] }[] } };

    const globs = body.applinks.details.flatMap((d) => (d.components ?? []).map((c) => c['/']));
    expect(globs.length).toBeGreaterThan(0);
    expect(globs).not.toContain('/activate');
    expect(globs).not.toContain('/activate/*');
    // A bare wildcard would capture everything, /activate included.
    expect(globs).not.toContain('/*');

    for (const glob of globs) {
      const prefix = glob.replace(/\*$/, '');
      expect('/activate'.startsWith(prefix)).toBe(false);
    }
  });
});
