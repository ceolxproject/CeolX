// vi.mock hoisted by Vitest before imports.
const mockSendEmail = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('@CeolX/email', () => ({ sendEmail: mockSendEmail }));

import { afterEach, describe, expect, it, vi } from 'vitest';

import { handleEmailSend } from '../../jobs/handlers/email.js';

afterEach(() => {
  vi.clearAllMocks();
});

describe('handleEmailSend', () => {
  it('calls sendEmail with the correct to and subject for email-verification', async () => {
    await handleEmailSend({ to: 'user@example.com', template: 'email-verification', locale: 'en' });
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: 'Verify your CeolX email',
        tag: 'email-verification',
      })
    );
  });

  it('calls sendEmail with the correct subject for venue-activation', async () => {
    await handleEmailSend({ to: 'venue@example.com', template: 'venue-activation', locale: 'en' });
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ subject: 'Activate your CeolX venue profile' })
    );
  });

  it('calls sendEmail with the correct subject for event-approved', async () => {
    await handleEmailSend({ to: 'artist@example.com', template: 'event-approved', locale: 'en' });
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ subject: 'Your event is live on CeolX' })
    );
  });

  it('uses fallback subject for an unmapped template', async () => {
    // Future templates not yet in SUBJECT_MAP should not crash
    await handleEmailSend({
      to: 'user@example.com',
      // @ts-expect-error — intentionally testing unmapped value
      template: 'future-template',
      locale: 'en',
    });
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ subject: 'CeolX notification' })
    );
  });
});
