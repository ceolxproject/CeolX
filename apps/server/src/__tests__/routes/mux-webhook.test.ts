import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockVerifyAndUnwrap, mockUpdateChain, mockSetChain, mockWhereChain } = vi.hoisted(() => {
  const mockWhereChain = vi.fn(() => Promise.resolve());
  const mockSetChain = vi.fn(() => ({ where: mockWhereChain }));
  const mockUpdateChain = vi.fn(() => ({ set: mockSetChain }));
  const mockVerifyAndUnwrap = vi.fn();
  return { mockVerifyAndUnwrap, mockUpdateChain, mockSetChain, mockWhereChain };
});

vi.mock('@CeolX/api/services/mux', () => ({
  verifyAndUnwrap: mockVerifyAndUnwrap,
}));

vi.mock('@CeolX/db', () => ({
  db: { update: mockUpdateChain },
}));

vi.mock('@CeolX/db/schema/social', () => ({
  posts: {
    muxUploadId: 'mux_upload_id',
    muxAssetId: 'mux_asset_id',
    muxPlaybackId: 'mux_playback_id',
    muxStatus: 'mux_status',
    mediaUrl: 'media_url',
  },
}));

import webhooksRoutes from '../../routes/webhooks.js';

function buildApp() {
  const app = new Hono();
  app.route('/api/webhooks', webhooksRoutes);
  return app;
}

const READY_EVENT = {
  type: 'video.asset.ready' as const,
  data: {
    id: 'asset_xyz',
    upload_id: 'upl_abc',
    playback_ids: [{ id: 'pb_123', policy: 'public' }],
  },
};

const ERROR_EVENT = {
  type: 'video.asset.errored' as const,
  data: { id: 'asset_xyz', upload_id: 'upl_abc' },
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('POST /api/webhooks/mux', () => {
  it('returns 401 when verifyAndUnwrap rejects', async () => {
    mockVerifyAndUnwrap.mockRejectedValueOnce(new Error('bad sig'));
    const res = await buildApp().request('/api/webhooks/mux', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'mux-signature': 'invalid' },
      body: JSON.stringify(READY_EVENT),
    });
    expect(res.status).toBe(401);
  });

  it('updates posts on video.asset.ready', async () => {
    mockVerifyAndUnwrap.mockResolvedValueOnce(READY_EVENT);
    const res = await buildApp().request('/api/webhooks/mux', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'mux-signature': 'ok' },
      body: JSON.stringify(READY_EVENT),
    });
    expect(res.status).toBe(200);
    expect(mockSetChain).toHaveBeenCalledWith(
      expect.objectContaining({
        muxAssetId: 'asset_xyz',
        muxPlaybackId: 'pb_123',
        muxStatus: 'ready',
        mediaUrl: 'https://stream.mux.com/pb_123.m3u8',
      })
    );
    expect(mockWhereChain).toHaveBeenCalledTimes(1);
  });

  it('updates posts on video.asset.errored', async () => {
    mockVerifyAndUnwrap.mockResolvedValueOnce(ERROR_EVENT);
    const res = await buildApp().request('/api/webhooks/mux', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'mux-signature': 'ok' },
      body: JSON.stringify(ERROR_EVENT),
    });
    expect(res.status).toBe(200);
    expect(mockSetChain).toHaveBeenCalledWith(expect.objectContaining({ muxStatus: 'errored' }));
  });

  it('ignores other event types but still returns 200', async () => {
    mockVerifyAndUnwrap.mockResolvedValueOnce({
      type: 'video.upload.created',
      data: { id: 'upl' },
    });
    const res = await buildApp().request('/api/webhooks/mux', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'mux-signature': 'ok' },
      body: JSON.stringify({ type: 'video.upload.created', data: { id: 'upl' } }),
    });
    expect(res.status).toBe(200);
    expect(mockSetChain).not.toHaveBeenCalled();
  });

  it('skips the DB update when video.asset.ready has no playback_ids', async () => {
    mockVerifyAndUnwrap.mockResolvedValueOnce({
      type: 'video.asset.ready',
      data: { id: 'asset_xyz', upload_id: 'upl_abc', playback_ids: [] },
    });
    const res = await buildApp().request('/api/webhooks/mux', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'mux-signature': 'ok' },
      body: JSON.stringify({ ...READY_EVENT, data: { ...READY_EVENT.data, playback_ids: [] } }),
    });
    expect(res.status).toBe(200);
    expect(mockSetChain).not.toHaveBeenCalled();
  });
});
