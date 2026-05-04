import { describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/trpc', () => ({
  trpc: { uploads: { createMuxUpload: { mutationOptions: () => ({}) } } },
}));

vi.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ mutateAsync: vi.fn() }),
  useQueryClient: () => ({}),
}));

vi.mock('react', () => ({
  useState: vi.fn(() => [false, vi.fn()]),
  useCallback: <T>(fn: T) => fn,
}));

import type { MuxUploadResult } from '../use-video-upload';
import { pollMuxStatus } from '../use-video-upload';

const sleepMock = vi.fn(() => Promise.resolve());

describe('pollMuxStatus', () => {
  it('returns immediately when the first poll reports ready', async () => {
    const fetchStatus = vi.fn().mockResolvedValueOnce({
      uploadId: 'u1',
      status: 'ready',
      playbackId: 'pb_1',
      assetId: 'a_1',
    } satisfies MuxUploadResult);
    const result = await pollMuxStatus({
      uploadId: 'u1',
      fetchStatus,
      sleep: sleepMock,
    });
    expect(result.status).toBe('ready');
    expect(fetchStatus).toHaveBeenCalledTimes(1);
    expect(sleepMock).not.toHaveBeenCalled();
  });

  it('polls until status leaves pending', async () => {
    const fetchStatus = vi
      .fn()
      .mockResolvedValueOnce({ uploadId: 'u1', status: 'pending', playbackId: null, assetId: null })
      .mockResolvedValueOnce({ uploadId: 'u1', status: 'pending', playbackId: null, assetId: null })
      .mockResolvedValueOnce({
        uploadId: 'u1',
        status: 'ready',
        playbackId: 'pb_1',
        assetId: 'a_1',
      });
    sleepMock.mockClear();

    const result = await pollMuxStatus({
      uploadId: 'u1',
      fetchStatus,
      sleep: sleepMock,
      intervalMs: 100,
    });
    expect(result.status).toBe('ready');
    expect(fetchStatus).toHaveBeenCalledTimes(3);
    expect(sleepMock).toHaveBeenCalledTimes(2);
  });

  it('returns the last-known status on timeout', async () => {
    const fetchStatus = vi.fn().mockResolvedValue({
      uploadId: 'u1',
      status: 'pending',
      playbackId: null,
      assetId: null,
    });
    sleepMock.mockClear();
    let nowValue = 0;
    const result = await pollMuxStatus({
      uploadId: 'u1',
      fetchStatus,
      sleep: sleepMock,
      intervalMs: 100,
      timeoutMs: 250,
      now: () => {
        nowValue += 100;
        return nowValue;
      },
    });
    expect(result.status).toBe('pending');
  });

  it('forwards errored status without further polling', async () => {
    const fetchStatus = vi.fn().mockResolvedValueOnce({
      uploadId: 'u1',
      status: 'errored',
      playbackId: null,
      assetId: 'a_1',
    });
    sleepMock.mockClear();
    const result = await pollMuxStatus({
      uploadId: 'u1',
      fetchStatus,
      sleep: sleepMock,
    });
    expect(result.status).toBe('errored');
    expect(fetchStatus).toHaveBeenCalledTimes(1);
  });
});
