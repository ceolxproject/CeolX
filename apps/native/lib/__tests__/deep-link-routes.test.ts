import { describe, expect, it } from 'vitest';

import { extractLinkTarget, redirectSharedPath } from '../deep-link-routes';

describe('extractLinkTarget', () => {
  it('keeps the first segment of a custom-scheme link', () => {
    // `event` sits where a host would be, but it names the route.
    expect(extractLinkTarget('ceolx://event/abc-123')).toEqual({
      path: '/event/abc-123',
      href: '/event/abc-123',
    });
  });

  it('drops the host of an https link', () => {
    expect(extractLinkTarget('https://api.ceolx.com/event/abc-123')).toEqual({
      path: '/event/abc-123',
      href: '/event/abc-123',
    });
  });

  it('keeps a query string on the href but off the path', () => {
    // The router reports a pathname without the query, so comparing against a
    // path that carries one would never match.
    expect(extractLinkTarget('ceolx://sign-up?role=artist')).toEqual({
      path: '/sign-up',
      href: '/sign-up?role=artist',
    });
  });

  it('passes a bare path through', () => {
    // What redirectSystemPath returns, and what it may be handed on a re-entry.
    expect(extractLinkTarget('/discover/event/abc-123')).toEqual({
      path: '/discover/event/abc-123',
      href: '/discover/event/abc-123',
    });
  });

  it('ignores a bare scheme that names no screen', () => {
    expect(extractLinkTarget('ceolx://')).toBeNull();
  });

  it('ignores something that is not a link', () => {
    expect(extractLinkTarget('not a url')).toBeNull();
  });
});

describe('redirectSharedPath', () => {
  /**
   * The landing that matters: shared links are minted as /event/<id> but the
   * screen people expect lives in the discover tab, so the tab bar is there and
   * back reaches the feed.
   */
  it('sends a shared event link into the discover tab', () => {
    expect(redirectSharedPath('ceolx://event/abc-123')).toBe('/discover/event/abc-123');
  });

  it('rewrites the https form the same way', () => {
    expect(redirectSharedPath('https://api.ceolx.com/event/abc-123')).toBe(
      '/discover/event/abc-123'
    );
  });

  it('is stable once rewritten', () => {
    // redirectSystemPath runs on every incoming link, including ones already
    // pointing at the tab route — rewriting twice must not nest.
    expect(redirectSharedPath('/discover/event/abc-123')).toBe('/discover/event/abc-123');
  });

  it('leaves post links alone', () => {
    // Post detail is a real top-level screen; only events live in a tab.
    expect(redirectSharedPath('ceolx://post/xyz')).toBe('ceolx://post/xyz');
  });

  it.each([
    ['ceolx://u/priya'],
    ['ceolx://sign-up?role=artist'],
    ['ceolx://verify-email?token=abc'],
    ['ceolx://artist/abc-123'],
  ])('leaves %s untouched', (url) => {
    expect(redirectSharedPath(url)).toBe(url);
  });

  it('does not rewrite a deeper event path', () => {
    // Only the shared two-segment form is ours to move.
    expect(redirectSharedPath('ceolx://event/abc-123/analytics')).toBe(
      'ceolx://event/abc-123/analytics'
    );
  });

  it('leaves an unreadable link alone rather than dropping it', () => {
    expect(redirectSharedPath('not a url')).toBe('not a url');
  });
});
