import { TRPCError } from '@trpc/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  envState,
  mockUploadsCreate,
  mockAssetsDelete,
  mockVerifySignature,
  mockUnwrap,
  MuxConstructor,
} = vi.hoisted(() => {
  const envState: Record<string, string | undefined> = {
    MUX_TOKEN_ID: 'test_id',
    MUX_TOKEN_SECRET: 'test_secret',
    MUX_WEBHOOK_SECRET: 'test_webhook_secret',
  };
  const mockUploadsCreate = vi.fn();
  const mockAssetsDelete = vi.fn();
  const mockVerifySignature = vi.fn();
  const mockUnwrap = vi.fn();
  // Use a function with `this`-assignment so `new MuxConstructor(...)` works
  // — `vi.fn().mockImplementation(() => obj)` returns the object only when
  // called as a function, not via `new`.
  const MuxConstructor = vi.fn(function (this: Record<string, unknown>) {
    this.video = {
      uploads: { create: mockUploadsCreate },
      assets: { delete: mockAssetsDelete },
    };
    this.webhooks = {
      verifySignature: mockVerifySignature,
      unwrap: mockUnwrap,
    };
  });
  return {
    envState,
    mockUploadsCreate,
    mockAssetsDelete,
    mockVerifySignature,
    mockUnwrap,
    MuxConstructor,
  };
});

vi.mock('@CeolX/env/server', () => ({
  get env() {
    return envState;
  },
}));

vi.mock('@mux/mux-node', () => ({
  default: MuxConstructor,
  Mux: MuxConstructor,
}));

beforeEach(() => {
  Object.assign(envState, {
    MUX_TOKEN_ID: 'test_id',
    MUX_TOKEN_SECRET: 'test_secret',
    MUX_WEBHOOK_SECRET: 'test_webhook_secret',
  });
  mockUploadsCreate.mockReset();
  mockAssetsDelete.mockReset();
  mockVerifySignature.mockReset();
  mockUnwrap.mockReset();
  MuxConstructor.mockClear();
  // The mux service caches its client at module scope. Drop the cached
  // module so each test starts fresh.
  vi.resetModules();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createDirectUpload', () => {
  it('returns uploadUrl + uploadId + expiresIn', async () => {
    mockUploadsCreate.mockResolvedValueOnce({
      url: 'https://upload.mux.com/upl_123',
      id: 'upl_123',
    });
    const { createDirectUpload } = await import('../services/mux.js');
    const result = await createDirectUpload();
    expect(result).toEqual({
      uploadUrl: 'https://upload.mux.com/upl_123',
      uploadId: 'upl_123',
      expiresIn: 3600,
    });
  });

  it('asks Mux for a public-playback asset', async () => {
    mockUploadsCreate.mockResolvedValueOnce({ url: 'u', id: 'i' });
    const { createDirectUpload } = await import('../services/mux.js');
    await createDirectUpload();
    const callArg = mockUploadsCreate.mock.calls[0]?.[0] as
      | { new_asset_settings?: { playback_policy?: string[] } }
      | undefined;
    expect(callArg?.new_asset_settings?.playback_policy).toEqual(['public']);
  });

  it('throws PRECONDITION_FAILED when MUX_TOKEN_ID is missing', async () => {
    envState.MUX_TOKEN_ID = undefined;
    const { createDirectUpload } = await import('../services/mux.js');
    await expect(createDirectUpload()).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
  });
});

describe('deleteAsset', () => {
  it('forwards the assetId to the Mux SDK', async () => {
    mockAssetsDelete.mockResolvedValueOnce(undefined);
    const { deleteAsset } = await import('../services/mux.js');
    await deleteAsset('asset_xyz');
    expect(mockAssetsDelete).toHaveBeenCalledWith('asset_xyz');
  });

  it('throws PRECONDITION_FAILED when env is missing', async () => {
    envState.MUX_TOKEN_SECRET = undefined;
    const { deleteAsset } = await import('../services/mux.js');
    await expect(deleteAsset('asset_xyz')).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
  });
});

describe('verifyAndUnwrap', () => {
  const RAW = '{"type":"video.asset.ready","data":{"id":"asset_1"}}';
  const HEADERS = { 'mux-signature': 't=1,v1=abc' };

  it('returns the unwrapped event on a valid signature', async () => {
    const event = { type: 'video.asset.ready', data: { id: 'asset_1' } };
    mockVerifySignature.mockResolvedValueOnce(undefined);
    mockUnwrap.mockResolvedValueOnce(event);
    const { verifyAndUnwrap } = await import('../services/mux.js');
    await expect(verifyAndUnwrap(RAW, HEADERS)).resolves.toEqual(event);
    expect(mockVerifySignature).toHaveBeenCalledWith(RAW, HEADERS);
  });

  it('throws UNAUTHORIZED when verification fails', async () => {
    mockVerifySignature.mockRejectedValueOnce(new Error('Invalid signature'));
    const { verifyAndUnwrap } = await import('../services/mux.js');
    await expect(verifyAndUnwrap(RAW, HEADERS)).rejects.toBeInstanceOf(TRPCError);
  });

  it('throws PRECONDITION_FAILED when MUX_WEBHOOK_SECRET is missing', async () => {
    envState.MUX_WEBHOOK_SECRET = undefined;
    const { verifyAndUnwrap } = await import('../services/mux.js');
    await expect(verifyAndUnwrap(RAW, HEADERS)).rejects.toBeInstanceOf(TRPCError);
  });
});
