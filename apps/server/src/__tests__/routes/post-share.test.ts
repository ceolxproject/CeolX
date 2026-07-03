import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { mockFindFirst } = vi.hoisted(() => ({ mockFindFirst: vi.fn() }));

vi.mock('@CeolX/db', () => ({
  db: { query: { posts: { findFirst: mockFindFirst } } },
}));

// Defaults (no store overrides) so the route derives the Play Store / App Store
// fallback urls itself.
vi.mock('@CeolX/env/server', () => ({
  env: { IOS_APP_STORE_URL: undefined, ANDROID_PLAY_STORE_URL: undefined },
}));

import postShareRoute, { derivePostOgImage } from '../../routes/post-share.js';

function buildApp() {
  const app = new Hono();
  app.route('/', postShareRoute);
  return app;
}

const VALID_ID = '11111111-1111-4111-8111-111111111111';

afterEach(() => {
  mockFindFirst.mockReset();
});

describe('derivePostOgImage', () => {
  it('uses the Mux thumbnail for video posts', () => {
    expect(derivePostOgImage({ mediaType: 'video', mediaUrl: null, muxPlaybackId: 'pb_abc' })).toBe(
      'https://image.mux.com/pb_abc/thumbnail.jpg?width=1200&height=630&fit_mode=pad'
    );
  });

  it('uses the CDN url for image posts', () => {
    expect(
      derivePostOgImage({ mediaType: 'image', mediaUrl: 'https://cdn/x.jpg', muxPlaybackId: null })
    ).toBe('https://cdn/x.jpg');
  });

  it('returns null for audio/text posts (link still unfurls with text)', () => {
    expect(
      derivePostOgImage({ mediaType: 'text', mediaUrl: null, muxPlaybackId: null })
    ).toBeNull();
    expect(
      derivePostOgImage({ mediaType: 'video', mediaUrl: null, muxPlaybackId: null })
    ).toBeNull();
  });
});

describe('GET /post/:id', () => {
  it('renders OG tags, a deep link, and store buttons for a video post', async () => {
    mockFindFirst.mockResolvedValue({
      id: VALID_ID,
      caption: 'Live trad session tonight',
      mediaType: 'video',
      mediaUrl: null,
      muxPlaybackId: 'pb_xyz',
      deletedAt: null,
      author: { name: 'Tune Bomb' },
    });

    const res = await buildApp().request(`/post/${VALID_ID}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/html/);
    expect(res.headers.get('cache-control')).toMatch(/max-age=300/);

    const html = await res.text();
    expect(html).toContain('<meta property="og:title" content="Tune Bomb on CeolX">');
    expect(html).toContain('Live trad session tonight');
    expect(html).toContain(`<meta property="og:url" content="https://ceolx.com/post/${VALID_ID}">`);
    expect(html).toContain('https://image.mux.com/pb_xyz/thumbnail.jpg');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
    // Manual "open in app" deep link + both store buttons.
    expect(html).toContain(`href="ceolx://post/${VALID_ID}"`);
    expect(html).toContain('play.google.com/store/apps/details?id=com.ceolx.app');
    expect(html).toContain('apps.apple.com');
  });

  it('omits og:image for text posts and uses the summary card', async () => {
    mockFindFirst.mockResolvedValue({
      id: VALID_ID,
      caption: 'No media here',
      mediaType: 'text',
      mediaUrl: null,
      muxPlaybackId: null,
      deletedAt: null,
      author: { name: 'Aoife' },
    });

    const html = await (await buildApp().request(`/post/${VALID_ID}`)).text();
    expect(html).not.toContain('og:image');
    expect(html).toContain('<meta name="twitter:card" content="summary">');
  });

  it('escapes HTML in the caption so a post cannot inject markup', async () => {
    mockFindFirst.mockResolvedValue({
      id: VALID_ID,
      caption: '<script>alert(1)</script>',
      mediaType: 'text',
      mediaUrl: null,
      muxPlaybackId: null,
      deletedAt: null,
      author: { name: 'x' },
    });

    const html = await (await buildApp().request(`/post/${VALID_ID}`)).text();
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('returns a 404 download page for a malformed id without touching the db', async () => {
    const res = await buildApp().request('/post/not-a-uuid');
    expect(res.status).toBe(404);
    expect(res.headers.get('cache-control')).toMatch(/no-store/);
    expect(mockFindFirst).not.toHaveBeenCalled();

    const html = await res.text();
    // Still a useful page — store buttons convert a non-user.
    expect(html).toContain('apps.apple.com');
    expect(html).toContain('play.google.com');
  });

  it('returns a 404 download page when the post is missing or deleted', async () => {
    mockFindFirst.mockResolvedValue(undefined);
    const missing = await buildApp().request(`/post/${VALID_ID}`);
    expect(missing.status).toBe(404);

    mockFindFirst.mockResolvedValue({
      id: VALID_ID,
      caption: 'gone',
      mediaType: 'text',
      mediaUrl: null,
      muxPlaybackId: null,
      deletedAt: new Date(),
      author: { name: 'x' },
    });
    const deleted = await buildApp().request(`/post/${VALID_ID}`);
    expect(deleted.status).toBe(404);
  });
});
