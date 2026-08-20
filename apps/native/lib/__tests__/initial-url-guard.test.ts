import { describe, expect, it } from 'vitest';

import { decideInitialUrl } from '../initial-url-guard';

describe('decideInitialUrl', () => {
  it('does nothing when the app was not opened from a link', () => {
    expect(decideInitialUrl({ initialUrl: null, currentPath: '/map' })).toEqual({
      action: 'ignore',
      reason: 'no-url',
    });
  });

  /**
   * The bug this guard exists for: the launch carried event 456, the router
   * restored the state showing event 123 and discarded the URL. The recovery
   * targets the rewritten route so it lands where the link normally would.
   */
  it('recovers a link the router landed away from', () => {
    expect(
      decideInitialUrl({
        initialUrl: 'ceolx://event/456',
        currentPath: '/discover/event/123',
      })
    ).toEqual({ action: 'navigate', href: '/discover/event/456' });
  });

  it('leaves a normal cold start alone', () => {
    expect(
      decideInitialUrl({
        initialUrl: 'ceolx://event/456',
        currentPath: '/discover/event/456',
      })
    ).toEqual({ action: 'ignore', reason: 'already-applied' });
  });

  /**
   * The comparison has to accept both the address the link was shared as and
   * the route it actually opens, or every rewritten link would look like one
   * that never arrived and get navigated a second time.
   */
  it('accepts the un-rewritten path as applied too', () => {
    expect(
      decideInitialUrl({
        initialUrl: 'ceolx://event/456',
        currentPath: '/event/456',
      })
    ).toEqual({ action: 'ignore', reason: 'already-applied' });
  });

  it('recovers an https share link', () => {
    expect(
      decideInitialUrl({
        initialUrl: 'https://api.ceolx.com/post/xyz',
        currentPath: '/discover/event/123',
      })
    ).toEqual({ action: 'navigate', href: '/post/xyz' });
  });

  it('carries the query through when recovering', () => {
    expect(
      decideInitialUrl({
        initialUrl: 'ceolx://sign-up?role=artist',
        currentPath: '/map',
      })
    ).toEqual({ action: 'navigate', href: '/sign-up?role=artist' });
  });

  it('ignores a launch url it cannot read', () => {
    expect(decideInitialUrl({ initialUrl: 'ceolx://', currentPath: '/map' })).toEqual({
      action: 'ignore',
      reason: 'unparsable',
    });
  });

  it('tolerates a trailing slash on either side', () => {
    expect(
      decideInitialUrl({
        initialUrl: 'ceolx://event/456/',
        currentPath: '/discover/event/456',
      })
    ).toEqual({ action: 'ignore', reason: 'already-applied' });
  });

  /**
   * A profile link resolves through a handle lookup, so the router ends up on
   * the artist route rather than the path the link named. Recovering there
   * would push a duplicate of a screen the user is already looking at, but the
   * pathname is only read once the launch URL resolves, by which point the
   * lookup has normally landed.
   */
  it('recovers a handle link only when the router is somewhere unrelated', () => {
    expect(decideInitialUrl({ initialUrl: 'ceolx://u/priya', currentPath: '/u/priya' })).toEqual({
      action: 'ignore',
      reason: 'already-applied',
    });

    expect(decideInitialUrl({ initialUrl: 'ceolx://u/priya', currentPath: '/map' })).toEqual({
      action: 'navigate',
      href: '/u/priya',
    });
  });
});
