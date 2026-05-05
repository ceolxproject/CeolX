import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { UserRole } from '@CeolX/shared';

const {
  mockPostsFindFirst,
  mockPresignUpload,
  mockPresignDelete,
  mockCreateDirectUpload,
  mockDeleteAsset,
  mockRetrieveUploadStatus,
} = vi.hoisted(() => {
  return {
    mockPostsFindFirst: vi.fn(),
    mockPresignUpload: vi.fn(),
    mockPresignDelete: vi.fn(),
    mockCreateDirectUpload: vi.fn(),
    mockDeleteAsset: vi.fn(),
    mockRetrieveUploadStatus: vi.fn(),
  };
});

vi.mock('@CeolX/db', () => ({
  db: {
    query: {
      posts: { findFirst: mockPostsFindFirst },
    },
  },
}));

vi.mock('@CeolX/db/schema/social', () => ({
  posts: {
    id: 'id',
    createdBy: 'created_by',
    muxUploadId: 'mux_upload_id',
    muxAssetId: 'mux_asset_id',
    deletedAt: 'deleted_at',
  },
}));

vi.mock('../services/s3-presigner', () => ({
  presignUpload: mockPresignUpload,
  presignDelete: mockPresignDelete,
}));

vi.mock('../services/mux', () => ({
  createDirectUpload: mockCreateDirectUpload,
  deleteAsset: mockDeleteAsset,
  retrieveUploadStatus: mockRetrieveUploadStatus,
}));

import { t } from '../index';
import { uploadsRouter } from '../routers/uploads';

const createCaller = t.createCallerFactory(uploadsRouter);

function anonCaller() {
  return createCaller({ session: null } as never);
}

function authedCaller(userId = 'user-1', role: UserRole = 'artist' as UserRole) {
  return createCaller({
    session: { user: { id: userId, currentRole: role } },
    userId,
    currentRole: role,
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('uploads.presignUpload', () => {
  it('rejects unauthenticated callers', async () => {
    const caller = anonCaller();
    await expect(
      caller.presignUpload({ type: 'profile_image', contentType: 'image/jpeg' })
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('delegates to the s3 presigner with the caller userId', async () => {
    mockPresignUpload.mockResolvedValueOnce({
      uploadUrl: 'https://s3/u',
      cdnUrl: 'https://cdn/u',
      key: 'profiles/user-1/x.jpg',
      expiresIn: 300,
    });
    const caller = authedCaller('user-1');
    const result = await caller.presignUpload({
      type: 'profile_image',
      contentType: 'image/jpeg',
    });
    expect(mockPresignUpload).toHaveBeenCalledWith({
      type: 'profile_image',
      contentType: 'image/jpeg',
      userId: 'user-1',
    });
    expect(result.cdnUrl).toBe('https://cdn/u');
  });
});

describe('uploads.presignDelete', () => {
  it('rejects unauthenticated callers', async () => {
    const caller = anonCaller();
    await expect(caller.presignDelete({ key: 'posts/u/x.jpg' })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('delegates to the s3 presigner', async () => {
    mockPresignDelete.mockResolvedValueOnce({
      deleteUrl: 'https://s3/d',
      expiresIn: 300,
    });
    const caller = authedCaller('user-1');
    const result = await caller.presignDelete({ key: 'posts/user-1/x.jpg' });
    expect(mockPresignDelete).toHaveBeenCalledWith({
      key: 'posts/user-1/x.jpg',
      userId: 'user-1',
    });
    expect(result.deleteUrl).toBe('https://s3/d');
  });
});

describe('uploads.createMuxUpload', () => {
  it('rejects unauthenticated callers', async () => {
    const caller = anonCaller();
    await expect(caller.createMuxUpload({})).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('returns the Mux Direct Upload payload', async () => {
    mockCreateDirectUpload.mockResolvedValueOnce({
      uploadUrl: 'https://upload.mux.com/abc',
      uploadId: 'upl_abc',
      expiresIn: 3600,
    });
    const caller = authedCaller('user-1');
    const result = await caller.createMuxUpload({});
    expect(result.uploadId).toBe('upl_abc');
    expect(mockCreateDirectUpload).toHaveBeenCalled();
  });
});

describe('uploads.deleteMuxAsset', () => {
  it('rejects unauthenticated callers', async () => {
    const caller = anonCaller();
    await expect(caller.deleteMuxAsset({ assetId: 'a' })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('refuses to delete an asset the caller does not own', async () => {
    mockPostsFindFirst.mockResolvedValueOnce(undefined);
    const caller = authedCaller('user-1');
    await expect(caller.deleteMuxAsset({ assetId: 'asset_x' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(mockDeleteAsset).not.toHaveBeenCalled();
  });

  it('forwards to the mux service when ownership matches', async () => {
    mockPostsFindFirst.mockResolvedValueOnce({ id: 'post-1', muxAssetId: 'asset_x' });
    mockDeleteAsset.mockResolvedValueOnce(undefined);
    const caller = authedCaller('user-1');
    const result = await caller.deleteMuxAsset({ assetId: 'asset_x' });
    expect(mockDeleteAsset).toHaveBeenCalledWith('asset_x');
    expect(result).toEqual({ deleted: true });
  });
});

describe('uploads.getMuxUploadStatus', () => {
  it('rejects unauthenticated callers', async () => {
    const caller = anonCaller();
    await expect(caller.getMuxUploadStatus({ uploadId: 'upl' })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('returns the Mux upload status', async () => {
    mockRetrieveUploadStatus.mockResolvedValueOnce({
      status: 'ready',
      playbackId: 'pb_1',
      assetId: 'asset_1',
    });
    const caller = authedCaller('user-1');
    const result = await caller.getMuxUploadStatus({ uploadId: 'upl_1' });
    expect(result).toEqual({ status: 'ready', playbackId: 'pb_1', assetId: 'asset_1' });
    expect(mockRetrieveUploadStatus).toHaveBeenCalledWith('upl_1');
  });

  it('returns pending while the upload is still processing', async () => {
    mockRetrieveUploadStatus.mockResolvedValueOnce({
      status: 'pending',
      playbackId: null,
      assetId: null,
    });
    const caller = authedCaller('user-1');
    const result = await caller.getMuxUploadStatus({ uploadId: 'upl_1' });
    expect(result.status).toBe('pending');
  });
});
