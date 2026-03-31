import { describe, it, expect } from 'vitest';

import { AuthError, NetworkError, ApiError, isApiError } from '../index.js';

describe('AuthError', () => {
  it('has name "AuthError"', () => {
    const err = new AuthError(401, 'Unauthorized');
    expect(err.name).toBe('AuthError');
  });

  it('stores statusCode', () => {
    const err = new AuthError(401, 'Unauthorized');
    expect(err.statusCode).toBe(401);
  });

  it('is an instance of Error', () => {
    expect(new AuthError(401, 'msg')).toBeInstanceOf(Error);
  });
});

describe('NetworkError', () => {
  it('has name "NetworkError"', () => {
    expect(new NetworkError().name).toBe('NetworkError');
  });

  it('uses default message when none provided', () => {
    expect(new NetworkError().message).toBe('Network request failed');
  });

  it('accepts a custom message', () => {
    expect(new NetworkError('Timeout').message).toBe('Timeout');
  });
});

describe('ApiError', () => {
  it('has name "ApiError"', () => {
    expect(new ApiError(400, 'VALIDATION_ERROR', 'Bad input').name).toBe('ApiError');
  });

  it('stores statusCode and code', () => {
    const err = new ApiError(409, 'CONFLICT', 'Duplicate entry');
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe('CONFLICT');
  });
});

describe('isApiError', () => {
  it('returns true for ApiError instances', () => {
    expect(isApiError(new ApiError(500, 'SERVER_ERROR', 'Internal error'))).toBe(true);
  });

  it('returns false for generic Error', () => {
    expect(isApiError(new Error('generic'))).toBe(false);
  });

  it('returns false for non-error values', () => {
    expect(isApiError('string')).toBe(false);
    expect(isApiError(null)).toBe(false);
    expect(isApiError(42)).toBe(false);
  });

  it('returns false for AuthError (not ApiError)', () => {
    expect(isApiError(new AuthError(401, 'Unauthorized'))).toBe(false);
  });
});
