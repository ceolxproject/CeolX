import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockConstructEvent, mockHandleEvent, mockCaptureException } = vi.hoisted(() => ({
  mockConstructEvent: vi.fn(),
  mockHandleEvent: vi.fn(),
  mockCaptureException: vi.fn(),
}));

vi.mock('@CeolX/api/services/stripe', () => ({ constructWebhookEvent: mockConstructEvent }));
vi.mock('@CeolX/api/services/subscription-sync', () => ({
  handleStripeSubscriptionEvent: mockHandleEvent,
}));
vi.mock('@sentry/node', () => ({ captureException: mockCaptureException }));

// The other handlers in this route module pull in heavier dependencies; stub them
// so this file exercises the Stripe path alone.
vi.mock('@CeolX/api/services/mux', () => ({ verifyAndUnwrap: vi.fn() }));
vi.mock('@CeolX/db', () => ({ db: {} }));
vi.mock('@CeolX/db/schema/social', () => ({ posts: {} }));
vi.mock('../../jobs/handlers/index.js', () => ({ routeJob: vi.fn() }));
vi.mock('../../jobs/verify.js', () => ({ verifyQStashSignature: vi.fn() }));
vi.mock('../../services/subscription-scheduler.js', () => ({}));
vi.mock('../../lib/postmark-webhook.js', () => ({
  logPostmarkEvent: vi.fn(),
  parsePostmarkEvent: vi.fn(),
}));

import webhooksRoutes from '../../routes/webhooks.js';

function buildApp() {
  const app = new Hono();
  app.route('/api/webhooks', webhooksRoutes);
  return app;
}

const post = (body: string, headers: Record<string, string> = {}) =>
  buildApp().request('/api/webhooks/stripe', {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/json', ...headers },
  });

const SUB_EVENT = {
  id: 'evt_1',
  type: 'customer.subscription.updated',
  data: { object: { id: 'sub_1' } },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockConstructEvent.mockReturnValue(SUB_EVENT);
  mockHandleEvent.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('POST /api/webhooks/stripe — signature verification', () => {
  it('400s and processes nothing when the signature is invalid', async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error('No signatures found matching the expected signature');
    });

    const res = await post('{}', { 'stripe-signature': 'tampered' });

    expect(res.status).toBe(400);
    // The single most important assertion in this file: a forged payload must not
    // reach the state machine.
    expect(mockHandleEvent).not.toHaveBeenCalled();
  });

  it('400s when the signature header is absent entirely', async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error('Missing stripe-signature header');
    });

    const res = await post('{}');
    expect(res.status).toBe(400);
    expect(mockHandleEvent).not.toHaveBeenCalled();
  });

  it('passes the RAW body through unparsed, so the signature can match', async () => {
    // Re-serialising the JSON changes the bytes and verification fails. Whitespace
    // is deliberate here — it must survive verbatim.
    const raw = '{"id":"evt_1",  "type":"customer.subscription.updated"}';
    await post(raw, { 'stripe-signature': 't=1,v1=abc' });

    expect(mockConstructEvent).toHaveBeenCalledWith(raw, 't=1,v1=abc');
  });

  it('never echoes the payload back — it carries customer data', async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error('bad signature');
    });
    const res = await post('{"customer_email":"venue@example.com"}', {
      'stripe-signature': 'x',
    });
    expect(await res.text()).not.toContain('venue@example.com');
  });
});

describe('POST /api/webhooks/stripe — dispatch', () => {
  it('hands a verified event to the state machine and 200s', async () => {
    const res = await post('{}', { 'stripe-signature': 'ok' });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
    // Called with the scheduling hook so the trial-ending email can be queued when
    // a trial end date is first seen (D-30).
    expect(mockHandleEvent).toHaveBeenCalledWith(
      SUB_EVENT,
      expect.objectContaining({ notifyLinkedArtist: expect.any(Function) as unknown })
    );
  });

  it('500s so Stripe retries when processing fails', async () => {
    mockHandleEvent.mockRejectedValue(new Error('db down'));

    const res = await post('{}', { 'stripe-signature': 'ok' });

    // Every handler is idempotent, so a retry is always safe. Swallowing the error
    // with a 200 would silently lose the event.
    expect(res.status).toBe(500);
  });

  it('reports a processing failure to Sentry with the event identity', async () => {
    mockHandleEvent.mockRejectedValue(new Error('db down'));
    await post('{}', { 'stripe-signature': 'ok' });

    expect(mockCaptureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        extra: expect.objectContaining({
          stripeEventType: 'customer.subscription.updated',
          stripeEventId: 'evt_1',
        }) as unknown,
      })
    );
  });

  it('200s an event type it does not act on, so Stripe stops retrying it', async () => {
    mockConstructEvent.mockReturnValue({
      id: 'evt_2',
      type: 'payment_intent.succeeded',
      data: { object: {} },
    });

    const res = await post('{}', { 'stripe-signature': 'ok' });
    expect(res.status).toBe(200);
  });
});
