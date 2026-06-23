// vi.hoisted() is also lifted before imports — safe to reference inside vi.mock().
const { mockVerify } = vi.hoisted(() => ({ mockVerify: vi.fn() }));

vi.mock('@upstash/qstash', () => ({
  Receiver: vi.fn().mockImplementation(() => ({ verify: mockVerify })),
}));

import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { verifyQStashSignature } from '../../jobs/verify.js';

function buildApp() {
  const app = new Hono<{ Variables: { rawBody: string } }>();
  app.post('/webhooks/qstash', verifyQStashSignature, (c) =>
    c.json({ received: true, rawBody: c.get('rawBody') })
  );
  return app;
}

describe('verifyQStashSignature middleware', () => {
  beforeEach(() => {
    vi.stubEnv('QSTASH_CURRENT_SIGNING_KEY', 'current-key');
    vi.stubEnv('QSTASH_NEXT_SIGNING_KEY', 'next-key');
    vi.stubEnv('BETTER_AUTH_URL', 'https://api.ceolx.ie');
    mockVerify.mockResolvedValue(true); // safe default
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('returns 401 when Upstash-Signature header is missing', async () => {
    const app = buildApp();
    const res = await app.request('/webhooks/qstash', {
      method: 'POST',
      body: JSON.stringify({ type: 'email.send', payload: {} }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: 'Missing Upstash-Signature header' });
  });

  it('returns 401 when receiver.verify returns false', async () => {
    mockVerify.mockResolvedValue(false);

    const app = buildApp();
    const res = await app.request('/webhooks/qstash', {
      method: 'POST',
      body: '{"type":"email.send","payload":{}}',
      headers: {
        'Content-Type': 'application/json',
        'Upstash-Signature': 'v1=invalid',
      },
    });
    expect(res.status).toBe(401);
  });

  it('returns 401 when receiver.verify throws', async () => {
    mockVerify.mockRejectedValue(new Error('bad JWT'));

    const app = buildApp();
    const res = await app.request('/webhooks/qstash', {
      method: 'POST',
      body: '{"type":"email.send","payload":{}}',
      headers: {
        'Content-Type': 'application/json',
        'Upstash-Signature': 'v1=bad',
      },
    });
    expect(res.status).toBe(401);
  });

  it('calls next and sets rawBody when signature is valid', async () => {
    mockVerify.mockResolvedValue(true);

    const rawPayload = '{"type":"email.send","payload":{}}';
    const app = buildApp();
    const res = await app.request('/webhooks/qstash', {
      method: 'POST',
      body: rawPayload,
      headers: {
        'Content-Type': 'application/json',
        'Upstash-Signature': 'v1=valid',
      },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ received: true, rawBody: rawPayload });
  });
});
