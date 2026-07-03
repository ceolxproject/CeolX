import Autolinker from 'autolinker';

/**
 * Splits caption text into text and URL segments for rendering tappable links.
 * autolinker's TLD list detects bare domains ("claude.ai") but not non-domains
 * ("Node.js"). Joining every segment's `value` reproduces the input exactly.
 */
export type CaptionSegment =
  | { type: 'text'; value: string }
  | { type: 'url'; value: string; href: string };

const SCHEME = /^https?:\/\//i;

// URL-only — no in-app routes for email/phone/mention/hashtag.
const autolinker = new Autolinker({
  urls: true,
  email: false,
  phone: false,
  mention: false,
  hashtag: false,
});

export function splitCaptionLinks(text: string): CaptionSegment[] {
  const segments: CaptionSegment[] = [];
  let cursor = 0;

  for (const match of autolinker.parse(text)) {
    const start = match.getOffset();
    const matched = match.getMatchedText();

    if (start > cursor) segments.push({ type: 'text', value: text.slice(cursor, start) });

    // Lowercase the scheme — iOS SFSafariViewController rejects "Https://" —
    // and default scheme-less links to https.
    let href = match.getAnchorHref().replace(/^https?/i, (scheme) => scheme.toLowerCase());
    if (!SCHEME.test(matched)) href = href.replace(/^http:\/\//, 'https://');
    segments.push({ type: 'url', value: matched, href });

    cursor = start + matched.length;
  }

  if (cursor < text.length) segments.push({ type: 'text', value: text.slice(cursor) });
  return segments;
}
