import * as Sentry from '@sentry/node';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';

export const errorHandler = (err: Error, c: Context) => {
  console.error('[Error]', { message: err.message, stack: err.stack });

  // Capture unexpected server errors only — not expected 4xx client errors
  if (!(err instanceof HTTPException) || err.status >= 500) {
    Sentry.captureException(err, {
      extra: { route: c.req.path, method: c.req.method },
    });
  }

  if (err instanceof HTTPException) {
    return c.json(
      {
        error: err.constructor.name,
        code: `HTTP_${err.status}`,
        message: err.message,
        statusCode: err.status,
      },
      err.status
    );
  }

  return c.json(
    {
      error: 'InternalServerError',
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      statusCode: 500,
    },
    500
  );
};
