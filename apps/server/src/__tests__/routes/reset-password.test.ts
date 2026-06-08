import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import resetPasswordRoute from '../../routes/reset-password.js';

function buildApp() {
  const app = new Hono();
  app.route('/', resetPasswordRoute);
  return app;
}

describe('GET /reset-password', () => {
  it('fires the deep link exactly once and offers a manual fallback', async () => {
    const app = buildApp();
    const res = await app.request('/reset-password?token=abc123');

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/html/);

    const html = await res.text();

    // Single auto-redirect via JS. A meta-refresh AND a JS redirect both firing
    // delivers the ceolx:// intent twice on Android (custom-scheme navigation
    // does not unload the page), which re-anchors the app's splash and bounces
    // reset-password to sign-in. Exactly one auto-trigger. (Asana 1215040939202673)
    expect(html).not.toContain('http-equiv="refresh"');
    expect(html).toContain("window.location.replace('ceolx://reset-password?token=abc123')");
    // `.replace` (not `.href`) so the bridge page isn't kept in history — a back
    // navigation must not return to it and re-fire the intent.
    expect(html).not.toContain('window.location.href');

    // Exactly one auto-redirect script in the document.
    const autoRedirects = html.match(/window\.location\.replace\(/g) ?? [];
    expect(autoRedirects).toHaveLength(1);

    // Visible manual fallback for clients that block scripted scheme launches.
    expect(html).toContain('href="ceolx://reset-password?token=abc123"');
  });

  it('sets no-store cache headers (link is one-shot)', async () => {
    const app = buildApp();
    const res = await app.request('/reset-password?token=abc');
    expect(res.headers.get('cache-control')).toMatch(/no-store/);
  });

  it('rejects tokens containing HTML-unsafe characters', async () => {
    const app = buildApp();
    const evilToken = '"><script>alert(1)</script>';
    const res = await app.request(`/reset-password?token=${encodeURIComponent(evilToken)}`);

    expect(res.status).toBe(400);
    const html = await res.text();
    // The raw evil string must NEVER appear in the response body (no XSS escape hatch)
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('alert(1)');
  });

  it('returns an error page when token is missing', async () => {
    const app = buildApp();
    const res = await app.request('/reset-password');

    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toMatch(/missing|invalid/i);
    // Must not auto-redirect with an empty token
    expect(html).not.toContain('url=ceolx://reset-password?token=');
  });

  it('accepts BetterAuth-shaped tokens (URL-safe base64 + JWT-like)', async () => {
    const app = buildApp();
    const realisticToken = 'eyJhbGciOiJIUzI1NiJ9.somePayload.sig-with_chars';
    const res = await app.request(`/reset-password?token=${encodeURIComponent(realisticToken)}`);

    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain(`ceolx://reset-password?token=${realisticToken}`);
  });
});
