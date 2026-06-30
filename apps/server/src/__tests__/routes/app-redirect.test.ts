import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import appRedirectRoute from '../../routes/app-redirect.js';

function buildApp() {
  const app = new Hono();
  app.route('/', appRedirectRoute);
  return app;
}

describe('GET /r (app redirect bridge)', () => {
  it('redirects an allowlisted booking route to the ceolx:// scheme exactly once', async () => {
    const app = buildApp();
    const res = await app.request('/r?to=/(app)/(tabs)/bookings/b-123');

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/html/);

    const html = await res.text();
    expect(html).toContain("window.location.replace('ceolx://(app)/(tabs)/bookings/b-123')");
    expect(html).toContain('href="ceolx://(app)/(tabs)/bookings/b-123"');
    expect(html).not.toContain('http-equiv="refresh"');
    expect(html).not.toContain('window.location.href');

    const autoRedirects = html.match(/window\.location\.replace\(/g) ?? [];
    expect(autoRedirects).toHaveLength(1);
  });

  it('accepts the bare booking route form', async () => {
    const app = buildApp();
    const res = await app.request('/r?to=/bookings/b-9');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("window.location.replace('ceolx://bookings/b-9')");
  });

  it('sets no-store cache headers', async () => {
    const app = buildApp();
    const res = await app.request('/r?to=/bookings/b-1');
    expect(res.headers.get('cache-control')).toMatch(/no-store/);
  });

  it('returns 400 for a missing route', async () => {
    const app = buildApp();
    const res = await app.request('/r');
    expect(res.status).toBe(400);
    expect(await res.text()).not.toContain('ceolx://');
  });

  it('returns 400 for a route not on the allowlist (no open redirect)', async () => {
    const app = buildApp();
    const res = await app.request('/r?to=/(app)/(tabs)/settings');
    expect(res.status).toBe(400);
  });

  it('does not reflect an HTML-unsafe route into the response', async () => {
    const app = buildApp();
    const evil = '/bookings/"><script>alert(1)</script>';
    const res = await app.request(`/r?to=${encodeURIComponent(evil)}`);
    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).not.toContain('<script>alert(1)');
  });
});
