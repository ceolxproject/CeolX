import { TRPCClientError } from '@trpc/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { emitMock } = vi.hoisted(() => ({ emitMock: vi.fn<[], void>() }));
vi.mock('../session-events', () => ({
  emitSessionExpired: (): void => {
    emitMock();
  },
}));

import { handleQueryError } from '../query-error-handler';

// Build a TRPCClientError carrying a given tRPC code, matching how
// getTRPCErrorCode reads it (err.data.code).
function trpcErrorWithCode(code: string): TRPCClientError<never> {
  const err = new TRPCClientError<never>(code);
  (err as unknown as { data: { code: string } }).data = { code };
  return err;
}

describe('handleQueryError', () => {
  beforeEach(() => emitMock.mockClear());

  it('emits session-expired on a tRPC UNAUTHORIZED error', () => {
    handleQueryError(trpcErrorWithCode('UNAUTHORIZED'));
    expect(emitMock).toHaveBeenCalledTimes(1);
  });

  it('ignores FORBIDDEN', () => {
    handleQueryError(trpcErrorWithCode('FORBIDDEN'));
    expect(emitMock).not.toHaveBeenCalled();
  });

  it('ignores NOT_FOUND', () => {
    handleQueryError(trpcErrorWithCode('NOT_FOUND'));
    expect(emitMock).not.toHaveBeenCalled();
  });

  it('ignores a plain network Error and does not throw', () => {
    expect(() => handleQueryError(new Error('Network request failed'))).not.toThrow();
    expect(emitMock).not.toHaveBeenCalled();
  });

  it('ignores a non-error thrown value and does not throw', () => {
    expect(() => handleQueryError('nope')).not.toThrow();
    expect(emitMock).not.toHaveBeenCalled();
  });
});
