import * as Sentry from '@sentry/node';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';

import { verifyAndUnwrap } from '@CeolX/api/services/mux';
import { constructWebhookEvent } from '@CeolX/api/services/stripe';
import { handleStripeSubscriptionEvent } from '@CeolX/api/services/subscription-sync';
import { db } from '@CeolX/db';
import { posts } from '@CeolX/db/schema/social';
import { NotificationTrigger } from '@CeolX/shared';

import { routeJob } from '../jobs/handlers/index.js';
import { verifyQStashSignature } from '../jobs/verify.js';
import { logPostmarkEvent, parsePostmarkEvent } from '../lib/postmark-webhook.js';
import { dispatchNotification } from '../services/notifications-dispatcher.js';
import { scheduleTrialEndingReminder } from '../services/subscription-scheduler.js';

const webhooksRoutes = new Hono<{ Variables: { rawBody: string } }>();

/**
 * Stripe webhook — the ONLY writer of venue subscription state (M8-T0 D-22).
 *
 * Subscription changes are asynchronous and arrive long after checkout: renewals,
 * failed payments, trial conversions and cancellations are all invisible to an
 * integration that only reads the success page. That is why this endpoint is not
 * optional for a subscription product.
 *
 * Two properties make every handler safe to redeliver and safe to receive out of
 * order, which is why there is no processed-event ledger:
 *   - subscription events re-fetch from Stripe and write current truth rather than
 *     trusting the payload's snapshot;
 *   - the invoice and dispute handlers are individually idempotent.
 *
 * Locally: `stripe listen --forward-to localhost:3001/api/webhooks/stripe`, then set
 * the printed `whsec_…` as STRIPE_WEBHOOK_SECRET.
 */
webhooksRoutes.post('/stripe', async (c) => {
  // Raw body, unparsed — re-serialising the JSON changes the bytes and the
  // signature stops matching.
  const rawBody = await c.req.text();

  let event: ReturnType<typeof constructWebhookEvent>;
  try {
    event = constructWebhookEvent(rawBody, c.req.header('stripe-signature'));
  } catch (err) {
    // A bad or absent signature is indistinguishable from a forgery. 400 and
    // process nothing. The body is never logged — it carries customer data.
    console.warn(
      '[Stripe] webhook verification failed:',
      err instanceof Error ? `${err.name}: ${err.message}` : err
    );
    return c.json({ error: 'unauthorized' }, 400);
  }

  try {
    await handleStripeSubscriptionEvent(event, {
      scheduleTrialEnding: scheduleTrialEndingReminder,
      // A-20: an artist whose event names this venue gets told the profile went on
      // hold. Their event stays visible (V-06); this is what puts the pressure on
      // the venue rather than on us.
      notifyLinkedArtist: async ({ artistUserId, eventId, eventTitle, venueName }) => {
        await dispatchNotification({
          trigger: NotificationTrigger.VENUE_ON_HOLD_TO_LINKED_ARTIST,
          recipientUserId: artistUserId,
          vars: { eventId, eventTitle, venueName },
        });
      },
    });
  } catch (err) {
    // 500 so Stripe retries with backoff. Every handler is idempotent, so a retry is
    // always safe — silently losing an event is not.
    console.error(`[Stripe] failed to process ${event.type} (${event.id}):`, err);
    Sentry.captureException(err, {
      extra: { stripeEventType: event.type, stripeEventId: event.id },
    });
    return c.json({ error: 'processing failed' }, 500);
  }

  return c.json({ received: true }, 200);
});

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

/**
 * Mux webhook — fired when video transcoding completes (or errors). Mux
 * signs the request with MUX_WEBHOOK_SECRET; we verify via the SDK
 * (mux.webhooks.verifySignature) which is wrapped by verifyAndUnwrap.
 *
 * On video.asset.ready we persist the resulting playback_id and rewrite
 * mediaUrl to the HLS streaming URL — this is what the mobile client
 * eventually renders. The handler is idempotent: a redelivered
 * video.asset.ready performs the same UPDATE and is harmless.
 */
webhooksRoutes.post('/mux', async (c) => {
  const rawBody = await c.req.text();
  const headers: Record<string, string> = {};
  c.req.raw.headers.forEach((value, key) => {
    headers[key] = value;
  });

  let event;
  try {
    event = await verifyAndUnwrap(rawBody, headers);
  } catch (err) {
    console.warn('[Mux] webhook verification failed:', err);
    return c.json({ error: 'unauthorized' }, 401);
  }

  if (event.type === 'video.asset.ready') {
    const data = event.data as {
      id: string;
      upload_id?: string;
      playback_ids?: { id: string; policy: string }[];
    };
    const playbackId = data.playback_ids?.[0]?.id;
    if (data.upload_id && playbackId) {
      await db
        .update(posts)
        .set({
          muxAssetId: data.id,
          muxPlaybackId: playbackId,
          muxStatus: 'ready',
          mediaUrl: `https://stream.mux.com/${playbackId}.m3u8`,
        })
        .where(eq(posts.muxUploadId, data.upload_id));
    }
  } else if (event.type === 'video.asset.errored') {
    const data = event.data as { upload_id?: string };
    if (data.upload_id) {
      await db
        .update(posts)
        .set({ muxStatus: 'errored' })
        .where(eq(posts.muxUploadId, data.upload_id));
    }
  }
  // Other event types (video.upload.created, video.asset.created, ...) are
  // acknowledged but not acted on. Returning 200 prevents Mux from retrying.

  return c.json({ received: true }, 200);
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
