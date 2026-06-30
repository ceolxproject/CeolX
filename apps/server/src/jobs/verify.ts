import { Receiver } from '@upstash/qstash';
import type { Context, Next } from 'hono';

import { getJobWebhookUrl } from './client.js';

// Receiver is instantiated once per process — signing keys are read from env at startup.
const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY ?? '',
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY ?? '',
});

// Hono middleware that verifies the Upstash-Signature header on incoming QStash webhooks.
// Must read the body as text BEFORE any other body parsing — once the stream is consumed
// it cannot be re-read. The raw string is stored in Hono context for the handler.
export const verifyQStashSignature = async (
  c: Context<{ Variables: { rawBody: string } }>,
  next: Next
): Promise<Response | void> => {
  const signature = c.req.header('Upstash-Signature');
  const body = await c.req.text();

  if (!signature) {
    return c.json({ error: 'Missing Upstash-Signature header' }, 401);
  }

  try {
    const isValid = await receiver.verify({
      signature,
      body,
      url: getJobWebhookUrl(),
    });

    if (!isValid) {
      return c.json({ error: 'Invalid signature' }, 401);
    }
  } catch {
    return c.json({ error: 'Signature verification failed' }, 401);
  }

  c.set('rawBody', body);
  return next();
};
