import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import webhooksRoutes from '../../routes/webhooks.js';

function buildApp() {
  const app = new Hono();
  app.route('/api/webhooks', webhooksRoutes);
  return app;
}

const SECRET = 'test-secret-abc';
const authHeader = `Basic ${Buffer.from(`postmark:${SECRET}`).toString('base64')}`;

const bouncePayload = {
  RecordType: 'Bounce',
  Type: 'HardBounce',
  TypeCode: 1,
  Email: 'bounced@example.com',
  MessageID: 'msg-abc',
  Details: 'mailbox does not exist',
};

const complaintPayload = {
  RecordType: 'SpamComplaint',
  Email: 'angry@example.com',
  MessageID: 'msg-xyz',
};

beforeEach(() => {
  vi.stubEnv('POSTMARK_WEBHOOK_SECRET', SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('POST /api/webhooks/postmark', () => {
  it('returns 503 when POSTMARK_WEBHOOK_SECRET is not configured', async () => {
    vi.unstubAllEnvs();
    const res = await buildApp().request('/api/webhooks/postmark', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(bouncePayload),
    });
    expect(res.status).toBe(503);
  });

  it('returns 401 when the Basic auth header is missing', async () => {
    const res = await buildApp().request('/api/webhooks/postmark', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(bouncePayload),
    });
    expect(res.status).toBe(401);
  });

  it('returns 401 when the Basic auth password is wrong', async () => {
    const badAuth = `Basic ${Buffer.from('postmark:wrong').toString('base64')}`;
    const res = await buildApp().request('/api/webhooks/postmark', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: badAuth },
      body: JSON.stringify(bouncePayload),
    });
    expect(res.status).toBe(401);
  });

  it('returns 400 on invalid JSON', async () => {
    const res = await buildApp().request('/api/webhooks/postmark', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: authHeader },
      body: 'not-json',
    });
    expect(res.status).toBe(400);
  });

  it('accepts a bounce payload with the correct Basic auth and logs it', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const res = await buildApp().request('/api/webhooks/postmark', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: authHeader },
      body: JSON.stringify(bouncePayload),
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ received: true, kind: 'bounce' });
    expect(warn).toHaveBeenCalled();
    const [[tag, entry]] = warn.mock.calls as [[string, Record<string, unknown>]];
    expect(tag).toBe('[postmark-webhook]');
    expect(entry).toMatchObject({ kind: 'bounce', email: 'bounced@example.com' });
  });

  it('accepts a spam-complaint payload', async () => {
    const res = await buildApp().request('/api/webhooks/postmark', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: authHeader },
      body: JSON.stringify(complaintPayload),
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ received: true, kind: 'spam-complaint' });
  });
});
