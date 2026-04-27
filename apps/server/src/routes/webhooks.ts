import { Hono } from 'hono';

import { routeJob } from '../jobs/handlers/index.js';
import { verifyQStashSignature } from '../jobs/verify.js';
import { logPostmarkEvent, parsePostmarkEvent } from '../lib/postmark-webhook.js';

const webhooksRoutes = new Hono<{ Variables: { rawBody: string } }>();

// TODO M8-T2: wire Stripe webhook handler
webhooksRoutes.post('/stripe', (c) =>
  c.json({ message: 'not implemented', route: 'POST /api/webhooks/stripe' })
);

/**
 * Postmark inbound webhook for bounce + spam-complaint events.
 *
 * Auth: HTTP Basic with username `postmark` and password = POSTMARK_WEBHOOK_SECRET.
 * Configure the matching credentials in Postmark dashboard → Servers →
 * Webhooks → Authentication.
 *
 * Postmark's own suppression list handles future-send blocking automatically;
 * this handler exists so we have an observable record of bounces and
 * complaints, and a future hook point to flag the user in-app (deferred).
 */
webhooksRoutes.post('/postmark', async (c) => {
  const secret = process.env.POSTMARK_WEBHOOK_SECRET;
  if (!secret) {
    return c.json({ error: 'webhook not configured' }, 503);
  }

  const expected = `Basic ${Buffer.from(`postmark:${secret}`).toString('base64')}`;
  if (c.req.header('authorization') !== expected) {
    return c.json({ error: 'unauthorized' }, 401);
  }

  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return c.json({ error: 'invalid json' }, 400);
  }

  const event = parsePostmarkEvent(body);
  logPostmarkEvent(event);
  return c.json({ received: true, kind: event.kind }, 200);
});

webhooksRoutes.post('/qstash', verifyQStashSignature, async (c) => {
  const rawBody = c.get('rawBody');

  try {
    await routeJob(rawBody);
    return c.json({ received: true }, 200);
  } catch (err) {
    console.error('[QStash] job failed:', err);
    // Return 500 so QStash retries the job. 400 would send it directly to DLQ.
    return c.json({ error: 'Job processing failed', retryable: true }, 500);
  }
});

export default webhooksRoutes;
