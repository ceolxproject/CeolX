// Mock @sentry/node before importing the module under test.
// vi.mock is hoisted by Vitest — placing the call here documents intent clearly.
vi.mock('@sentry/node', () => ({
  captureException: vi.fn(),
  setUser: vi.fn(),
  init: vi.fn(),
}));

import * as Sentry from '@sentry/node';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { errorHandler } from '../middleware/errorHandler.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildApp(throwFn: () => void) {
  const app = new Hono();
  app.get('/test', () => {
    throwFn();
    return new Response('ok');
  });
  app.onError(errorHandler);
  return app;
}

// ---------------------------------------------------------------------------
// Unit tests — errorHandler Sentry capture behaviour
// ---------------------------------------------------------------------------

describe('errorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Sentry capture — what SHOULD be captured
  // -------------------------------------------------------------------------

  it('captures generic (non-HTTP) errors in Sentry', async () => {
    const app = buildApp(() => {
      throw new Error('unexpected runtime error');
    });

    const res = await app.request('/test');

    expect(Sentry.captureException).toHaveBeenCalledOnce();
    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'unexpected runtime error' }) as unknown,
      expect.objectContaining({
        extra: expect.objectContaining({ route: '/test', method: 'GET' }) as unknown,
      }) as unknown
    );
    expect(res.status).toBe(500);
  });

  it('captures HTTPException with status >= 500 in Sentry', async () => {
    const app = buildApp(() => {
      throw new HTTPException(500, { message: 'internal server error' });
    });

    const res = await app.request('/test');

    expect(Sentry.captureException).toHaveBeenCalledOnce();
    expect(res.status).toBe(500);
  });

  it('captures HTTPException with status 503 in Sentry', async () => {
    const app = buildApp(() => {
      throw new HTTPException(503, { message: 'service unavailable' });
    });

    await app.request('/test');

    expect(Sentry.captureException).toHaveBeenCalledOnce();
  });

  // -------------------------------------------------------------------------
  // Sentry capture — what should NOT be captured
  // -------------------------------------------------------------------------

  it('does NOT capture HTTPException with 4xx status in Sentry', async () => {
    const app = buildApp(() => {
      throw new HTTPException(400, { message: 'bad request' });
    });

    const res = await app.request('/test');

    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(res.status).toBe(400);
  });

  it('does NOT capture HTTPException 401 (auth failure) in Sentry', async () => {
    const app = buildApp(() => {
      throw new HTTPException(401, { message: 'unauthorised' });
    });

    await app.request('/test');

    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('does NOT capture HTTPException 404 in Sentry', async () => {
    const app = buildApp(() => {
      throw new HTTPException(404, { message: 'not found' });
    });

    await app.request('/test');

    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('does NOT capture HTTPException 429 (rate limit) in Sentry', async () => {
    const app = buildApp(() => {
      throw new HTTPException(429, { message: 'too many requests' });
    });

    await app.request('/test');

    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Response shape — Sentry must not alter existing response format
  // -------------------------------------------------------------------------

  it('returns structured JSON for generic errors', async () => {
    const app = buildApp(() => {
      throw new Error('boom');
    });

    const res = await app.request('/test');
    const body: unknown = await res.json();

    expect(res.status).toBe(500);
    expect(body).toMatchObject({
      error: 'InternalServerError',
      code: 'INTERNAL_ERROR',
      statusCode: 500,
    });
  });

  it('returns structured JSON for HTTPException errors', async () => {
    const app = buildApp(() => {
      throw new HTTPException(422, { message: 'unprocessable entity' });
    });

    const res = await app.request('/test');
    const body: unknown = await res.json();

    expect(res.status).toBe(422);
    expect(body).toMatchObject({
      code: 'HTTP_422',
      statusCode: 422,
    });
  });
});
