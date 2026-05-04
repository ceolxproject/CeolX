import Mux from '@mux/mux-node';
import { TRPCError } from '@trpc/server';

import { env } from '@CeolX/env/server';

// Mux Direct Upload + asset deletion + webhook verification.
//
// The api server brokers Mux work but never proxies bytes — videos travel
// directly from mobile → mux.com via the upload URL minted in
// createDirectUpload. We only need server-side credentials for delete
// (frontend can't safely hold MUX_TOKEN_SECRET) and webhook verification.

// Mux Direct Uploads stay valid for ~1h by default; we surface the value
// to the client so it can fail fast on stale handles.
const MUX_UPLOAD_EXPIRES_SECONDS = 3600;

let cachedClient: Mux | null = null;

export function getMuxClient(): Mux {
  if (cachedClient) return cachedClient;
  const { MUX_TOKEN_ID, MUX_TOKEN_SECRET, MUX_WEBHOOK_SECRET } = env;
  if (!MUX_TOKEN_ID || !MUX_TOKEN_SECRET) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'Mux is not configured. Set MUX_TOKEN_ID and MUX_TOKEN_SECRET.',
    });
  }
  cachedClient = new Mux({
    tokenId: MUX_TOKEN_ID,
    tokenSecret: MUX_TOKEN_SECRET,
    webhookSecret: MUX_WEBHOOK_SECRET,
  });
  return cachedClient;
}

export type MuxDirectUpload = {
  uploadUrl: string;
  uploadId: string;
  expiresIn: number;
};

/**
 * Create a Mux Direct Upload for the mobile client. The client POSTs the
 * video file to `uploadUrl`; Mux begins transcoding immediately and pings
 * /api/webhooks/mux when the asset is ready.
 *
 * playback_policy is 'public' — CeolX serves HLS without signed JWTs in V1
 * (the spec confirms this). cors_origin: '*' is required for the browser/
 * native PUT to succeed.
 */
export async function createDirectUpload(): Promise<MuxDirectUpload> {
  const client = getMuxClient();
  const upload = await client.video.uploads.create({
    new_asset_settings: { playback_policy: ['public'] },
    cors_origin: '*',
  });
  return {
    uploadUrl: upload.url,
    uploadId: upload.id,
    expiresIn: MUX_UPLOAD_EXPIRES_SECONDS,
  };
}

/**
 * Delete a Mux asset. Caller MUST ownership-check the assetId before
 * invoking this (the uploads router does — by joining against `posts`
 * filtered by createdBy = ctx.userId).
 */
export async function deleteAsset(assetId: string): Promise<void> {
  const client = getMuxClient();
  await client.video.assets.delete(assetId);
}

export type MuxEvent = Awaited<ReturnType<Mux['webhooks']['unwrap']>>;

/**
 * Verify a Mux webhook signature and unwrap the event payload. Throws
 * UNAUTHORIZED on invalid signature, PRECONDITION_FAILED if the webhook
 * secret isn't configured. The Mux v14 SDK exposes verifySignature/unwrap
 * as async — both must be awaited even though they look synchronous.
 */
export async function verifyAndUnwrap(
  rawBody: string,
  headers: Record<string, string | string[] | undefined>
): Promise<MuxEvent> {
  if (!env.MUX_WEBHOOK_SECRET) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'Mux webhook secret is not configured. Set MUX_WEBHOOK_SECRET.',
    });
  }
  const client = getMuxClient();
  try {
    await client.webhooks.verifySignature(rawBody, headers);
    return await client.webhooks.unwrap(rawBody, headers);
  } catch (error) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Invalid Mux webhook signature',
      cause: error,
    });
  }
}

/**
 * Test-only hook. Production code should never reach for this — the
 * singleton is reset implicitly when the process restarts.
 */
export function __resetMuxClientForTests(): void {
  cachedClient = null;
}
