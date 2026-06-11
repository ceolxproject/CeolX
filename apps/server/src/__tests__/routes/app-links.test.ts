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
  it('serves valid JSON with the appID built from the Team ID, scoped to /post/*', async () => {
    mockEnv.APPLE_OAUTH_TEAM_ID = 'ABCDE12345';
    const res = await buildApp().request('/.well-known/apple-app-site-association');

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/application\/json/);

    const body = (await res.json()) as Aasa;
    const detail = body.applinks.details[0];
    expect(detail?.appIDs).toEqual(['ABCDE12345.ie.ceolx.app']);
    expect(detail?.components[0]?.['/']).toBe('/post/*');
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

    const body = (await res.json()) as AssetLinks;
    expect(Array.isArray(body)).toBe(true);
    expect(body[0]?.relation).toEqual(['delegate_permission/common.handle_all_urls']);
    expect(body[0]?.target.package_name).toBe('ie.ceolx.app');
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
