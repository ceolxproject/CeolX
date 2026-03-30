import { Hono } from 'hono';

import { routeJob } from '../jobs/handlers/index.js';
import { verifyQStashSignature } from '../jobs/verify.js';

const webhooksRoutes = new Hono<{ Variables: { rawBody: string } }>();

// TODO M8-T2: wire Stripe webhook handler
webhooksRoutes.post('/stripe', (c) =>
  c.json({ message: 'not implemented', route: 'POST /api/webhooks/stripe' })
);

// TODO M7: wire Postmark bounce and spam complaint handler
webhooksRoutes.post('/postmark', (c) =>
  c.json({ message: 'not implemented', route: 'POST /api/webhooks/postmark' })
);

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
