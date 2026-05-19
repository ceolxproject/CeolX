import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import verifyEmailRoute from '../../routes/verify-email.js';

function buildApp() {
  const app = new Hono();
  app.route('/', verifyEmailRoute);
  return app;
}

describe('GET /verify-email', () => {
  it('returns HTML with a meta-refresh to ceolx://verify-email and the token', async () => {
    const app = buildApp();
    const res = await app.request('/verify-email?token=abc123');

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/html/);

    const html = await res.text();
    expect(html).toContain(
      '<meta http-equiv="refresh" content="0;url=ceolx://verify-email?token=abc123">'
    );
    // Belt-and-braces JS redirect
    expect(html).toContain("window.location.href = 'ceolx://verify-email?token=abc123'");
    // Visible fallback link
    expect(html).toContain('href="ceolx://verify-email?token=abc123"');
  });

  it('sets no-store cache headers (link is one-shot)', async () => {
    const app = buildApp();
    const res = await app.request('/verify-email?token=abc');
    expect(res.headers.get('cache-control')).toMatch(/no-store/);
  });

  it('rejects tokens containing HTML-unsafe characters', async () => {
    const app = buildApp();
    const evilToken = '"><script>alert(1)</script>';
    const res = await app.request(`/verify-email?token=${encodeURIComponent(evilToken)}`);

    expect(res.status).toBe(400);
    const html = await res.text();
    // The raw evil string must NEVER appear in the response body (no XSS escape hatch)
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('alert(1)');
  });

  it('returns an error page when token is missing', async () => {
    const app = buildApp();
    const res = await app.request('/verify-email');

    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toMatch(/missing|invalid/i);
    // Must not auto-redirect with an empty token
    expect(html).not.toContain('url=ceolx://verify-email?token=');
  });

  it('accepts BetterAuth-shaped tokens (URL-safe base64 + JWT-like)', async () => {
    const app = buildApp();
    const realisticToken = 'eyJhbGciOiJIUzI1NiJ9.somePayload.sig-with_chars';
    const res = await app.request(`/verify-email?token=${encodeURIComponent(realisticToken)}`);

    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain(`ceolx://verify-email?token=${realisticToken}`);
  });
});
