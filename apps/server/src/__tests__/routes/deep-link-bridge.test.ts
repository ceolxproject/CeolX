import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import { createDeepLinkBridge } from '../../routes/deep-link-bridge.js';

function mount(bridge: Hono) {
  const app = new Hono();
  app.route('/', bridge);
  return app;
}

describe('createDeepLinkBridge — non-confirmable (e.g. reset-password)', () => {
  const bridge = createDeepLinkBridge({
    path: 'reset-password',
    errorTitle: 'Reset link error',
    errorBody: 'This reset link is missing or invalid.',
  });

  it('does not inject the desktop fallback or relax CSP', async () => {
    const res = await mount(bridge).request('/reset-password?token=abc123');
    expect(res.status).toBe(200);

    const html = await res.text();
    // No server-side completion for password reset — the app must collect a new
    // password, so the page only bounces into the app.
    expect(html).not.toContain('/reset-password/confirm');
    expect(html).not.toContain('fetch(');
    expect(res.headers.get('content-security-policy')).not.toContain('connect-src');
  });

  it('does not expose a /confirm endpoint', async () => {
    const res = await mount(bridge).request('/reset-password/confirm?token=abc123', {
      method: 'POST',
    });
    expect(res.status).toBe(404);
  });
});

describe('createDeepLinkBridge — confirmable (e.g. verify-email)', () => {
  function build(confirm: (token: string) => Promise<boolean>) {
    return createDeepLinkBridge({
      path: 'verify-email',
      errorTitle: 'Verification link error',
      errorBody: 'This verification link is missing or invalid.',
      confirm,
    });
  }

  it('injects the visibility-gated desktop fallback and allows same-origin fetch', async () => {
    const res = await mount(build(() => Promise.resolve(true))).request(
      '/verify-email?token=abc123'
    );
    expect(res.status).toBe(200);

    const html = await res.text();
    // Fallback posts to /confirm only when the app didn't take over the deep link.
    expect(html).toContain("fetch('/verify-email/confirm?token=abc123'");
    expect(html).toContain('visibilitychange');
    // Deep link is still fired exactly once — mobile keeps its auto-sign-in path.
    expect((html.match(/window\.location\.replace\(/g) ?? []).length).toBe(1);
    expect(res.headers.get('content-security-policy')).toContain("connect-src 'self'");
  });

  it('confirms server-side and reports verified:true when the token is accepted', async () => {
    const confirm = vi.fn(() => Promise.resolve(true));
    const res = await mount(build(confirm)).request('/verify-email/confirm?token=abc123', {
      method: 'POST',
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ verified: true });
    expect(confirm).toHaveBeenCalledWith('abc123');
  });

  it('reports verified:false for an expired/used token', async () => {
    const res = await mount(build(() => Promise.resolve(false))).request(
      '/verify-email/confirm?token=stale',
      { method: 'POST' }
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ verified: false });
  });

  it('swallows a throwing confirm handler and reports verified:false', async () => {
    const res = await mount(build(() => Promise.reject(new Error('better-auth blew up')))).request(
      '/verify-email/confirm?token=abc123',
      { method: 'POST' }
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ verified: false });
  });

  it('rejects a malformed token on /confirm without calling the handler', async () => {
    const confirm = vi.fn(() => Promise.resolve(true));
    const res = await mount(build(confirm)).request(
      `/verify-email/confirm?token=${encodeURIComponent('"><script>')}`,
      { method: 'POST' }
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ verified: false });
    expect(confirm).not.toHaveBeenCalled();
  });
});
