import { describe, expect, it } from 'vitest';

import { splitCaptionLinks } from './linkify';

const links = (text: string) => splitCaptionLinks(text).filter((segment) => segment.type === 'url');
const hrefs = (text: string) =>
  links(text).map((segment) => (segment.type === 'url' ? segment.href : ''));
const rejoin = (text: string) =>
  splitCaptionLinks(text)
    .map((segment) => segment.value)
    .join('');

describe('splitCaptionLinks', () => {
  it('returns one text segment when there are no URLs', () => {
    expect(splitCaptionLinks('just a caption, no links')).toEqual([
      { type: 'text', value: 'just a caption, no links' },
    ]);
  });

  it('returns [] for an empty string', () => {
    expect(splitCaptionLinks('')).toEqual([]);
  });

  it('detects an https URL mid-sentence', () => {
    expect(splitCaptionLinks('go https://a.com now')).toEqual([
      { type: 'text', value: 'go ' },
      { type: 'url', value: 'https://a.com', href: 'https://a.com' },
      { type: 'text', value: ' now' },
    ]);
  });

  it('keeps an explicit http:// scheme (does not force https)', () => {
    expect(links('x http://a.com')[0]).toEqual({
      type: 'url',
      value: 'http://a.com',
      href: 'http://a.com',
    });
  });

  it('detects a bare domain and defaults it to https', () => {
    expect(splitCaptionLinks('claude.ai')).toEqual([
      { type: 'url', value: 'claude.ai', href: 'https://claude.ai' },
    ]);
    expect(hrefs('try chatgpt.com today')).toEqual(['https://chatgpt.com']);
  });

  it('detects a bare domain with a ccTLD and a path', () => {
    expect(links('gigs at ceolx.ie/events tonight')[0]).toMatchObject({
      value: 'ceolx.ie/events',
      href: 'https://ceolx.ie/events',
    });
  });

  it('lowercases a mixed-case scheme but keeps the displayed text as typed', () => {
    expect(links('open Https://chatgpt.com')[0]).toMatchObject({
      value: 'Https://chatgpt.com',
      href: 'https://chatgpt.com',
    });
  });

  it('detects a www. domain and defaults it to https', () => {
    expect(links('visit www.example.com')[0]).toEqual({
      type: 'url',
      value: 'www.example.com',
      href: 'https://www.example.com',
    });
  });

  it.each([
    ['period', 'see https://a.com.', '.'],
    ['comma', 'see https://a.com,', ','],
    ['question mark', 'really https://a.com?', '?'],
    ['exclamation', 'wow https://a.com!', '!'],
    ['closing paren', 'here (https://a.com)', ')'],
  ])('keeps trailing %s out of the link', (_label, input, trailing) => {
    expect(links(input)[0]).toMatchObject({ value: 'https://a.com' });
    expect(splitCaptionLinks(input).at(-1)).toEqual({ type: 'text', value: trailing });
  });

  it('preserves path, query, params and fragment', () => {
    expect(links('go https://a.com/p/1?q=hi&x=2#top end')[0].value).toBe(
      'https://a.com/p/1?q=hi&x=2#top'
    );
  });

  it('detects several links (https / bare / www.) in one caption', () => {
    expect(hrefs('a https://x.com b claude.ai c www.z.net d')).toEqual([
      'https://x.com',
      'https://claude.ai',
      'https://www.z.net',
    ]);
  });

  it('does NOT linkify dotted non-domains', () => {
    expect(links('built with Node.js, see photo.jpg or v1.2.3')).toEqual([]);
  });

  it('splits a link surrounded by newlines', () => {
    expect(links('line one\nclaude.ai\nline two')).toHaveLength(1);
  });

  it.each([
    'no links at all',
    'go https://a.com now',
    'visit claude.ai and chatgpt.com!',
    '(https://a.com), then www.b.io. Thanks.',
    'multi\nline\nhttps://a.com/x?y=1\ncaption',
    'built with Node.js and photo.jpg',
  ])('round-trips: rejoining segments reproduces the input (%#)', (input) => {
    expect(rejoin(input)).toBe(input);
  });
});
