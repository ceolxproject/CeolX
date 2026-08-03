import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mutable so a test can flip platform; shareLink reads Platform.OS at call time.
const platform = vi.hoisted(() => ({ OS: 'ios' as 'ios' | 'android' }));
const shareMock = vi.hoisted(() => vi.fn());
const trackMock = vi.hoisted(() => vi.fn());

vi.mock('react-native', () => ({ Platform: platform, Share: { share: shareMock } }));
vi.mock('@CeolX/env/native', () => ({ env: { EXPO_PUBLIC_SHARE_BASE_URL: 'https://ceolx.com' } }));
vi.mock('@/lib/analytics', () => ({
  track: trackMock,
  AnalyticsEvent: { CONTENT_SHARED: 'content_shared' },
}));

const { buildShareContent, shareLink, shareUrlFor } = await import('../share');

const URL = 'https://ceolx.com/post/abc';
const TITLE = 'Check out this post on CeolX';

describe('shareUrlFor', () => {
  it('joins the base and path into one scheme-prefixed link', () => {
    expect(shareUrlFor('/post/abc')).toBe('https://ceolx.com/post/abc');
  });
});

describe('buildShareContent', () => {
  /**
   * The original bug: `url` was set *and* `message` ended in the same link. iOS
   * passes both to the target as separate activity items and the ones that take
   * both concatenate them, so the link posted twice. Android drops `url`, which is
   * why it only ever showed up on iOS.
   */
  it('includes the link exactly once', () => {
    const message = buildShareContent(URL, 'Great gig last night', TITLE).message ?? '';
    expect(message.split(URL).length - 1).toBe(1);
    expect(message).toBe(`Great gig last night\n\n${URL}`);
  });

  /**
   * The trap in fixing it: moving the link out of `message` into `url` also stops
   * the duplication, but every target that reads only the string — Copy included —
   * then shares a caption with no link. Verified on the simulator: pasting after
   * Copy gave the caption alone. So `message` must always carry the link.
   */
  it('never sets url, so no target can drop the link', () => {
    const content = buildShareContent(URL, 'Great gig last night', TITLE);
    expect('url' in content && content.url).toBeFalsy();
    expect(content.message).toContain(URL);
  });

  it('still shares the link when there is no caption', () => {
    expect(buildShareContent(URL, '   ', TITLE).message).toBe(URL);
  });

  it('keeps the title for the android chooser', () => {
    expect(buildShareContent(URL, 'caption', TITLE).title).toBe(TITLE);
  });
});

describe('shareLink analytics', () => {
  beforeEach(() => {
    platform.OS = 'ios';
    shareMock.mockReset();
    trackMock.mockReset();
  });

  it('records the outcome and target on ios', async () => {
    shareMock.mockResolvedValue({ action: 'sharedAction', activityType: 'com.apple.UIKit.copy' });

    await shareLink('post', URL, 'caption', TITLE);

    expect(trackMock).toHaveBeenCalledWith('content_shared', {
      type: 'post',
      completed: true,
      target: 'com.apple.UIKit.copy',
    });
  });

  it('records a dismissal on ios', async () => {
    shareMock.mockResolvedValue({ action: 'dismissedAction' });

    await shareLink('event', URL, 'caption', TITLE);

    expect(trackMock).toHaveBeenCalledWith('content_shared', {
      type: 'event',
      completed: false,
      target: null,
    });
  });

  /**
   * Android resolves with sharedAction whether the user shared or backed out, so
   * reporting `completed: true` there would be a confirmation we cannot actually
   * observe. Null is the honest answer.
   */
  it('leaves the outcome unknown on android rather than assuming success', async () => {
    platform.OS = 'android';
    shareMock.mockResolvedValue({ action: 'sharedAction' });

    await shareLink('profile', URL, 'caption', TITLE);

    expect(trackMock).toHaveBeenCalledWith('content_shared', {
      type: 'profile',
      completed: null,
      target: null,
    });
  });

  it('does not record anything when the share sheet throws', async () => {
    shareMock.mockRejectedValue(new Error('no sheet'));

    await expect(shareLink('post', URL, 'caption', TITLE)).rejects.toThrow();
    expect(trackMock).not.toHaveBeenCalled();
  });
});
