import { describe, expect, it } from 'vitest';

import { redactUrl } from '../instrumentation.js';

describe('Sentry credential scrubbing', () => {
  // app.ts keeps the activation token out of the access log, but Sentry captures the
  // full URL on errors AND on performance transactions — sampled at 10% in production,
  // so a live token could reach a third-party store on a request that never failed.
  it('redacts an activation token from a query string', () => {
    expect(redactUrl('/activate?token=abc123&plan=monthly')).toBe(
      '/activate?token=[redacted]&plan=monthly'
    );
  });

  it('keeps the non-sensitive parameters legible for debugging', () => {
    // The point is diagnosis without the credential, not blanket removal.
    expect(redactUrl('/activate?plan=annual&token=xyz')).toContain('plan=annual');
  });

  it('handles a relative path, which is what Sentry often passes', () => {
    // `new URL()` throws on a relative path — this is why the helper is hand-rolled.
    expect(() => redactUrl('/activate?token=abc')).not.toThrow();
  });

  it('redacts every occurrence, not just the first', () => {
    expect(redactUrl('/x?token=a&y=1&token=b')).toBe('/x?token=[redacted]&y=1&token=[redacted]');
  });

  it('redacts other credential-shaped params too', () => {
    expect(redactUrl('/verify?code=123&secret=shh')).toBe(
      '/verify?code=[redacted]&secret=[redacted]'
    );
  });

  it('stops at a fragment rather than swallowing it', () => {
    expect(redactUrl('/a?token=abc#section')).toBe('/a?token=[redacted]#section');
  });

  it('leaves a URL with nothing sensitive untouched', () => {
    expect(redactUrl('/health?verbose=1')).toBe('/health?verbose=1');
  });

  it('does not match a parameter that merely contains the word', () => {
    // `tokenCount` is not a credential; a sloppy regex would redact it.
    expect(redactUrl('/x?tokenCount=5')).toBe('/x?tokenCount=5');
  });
});
