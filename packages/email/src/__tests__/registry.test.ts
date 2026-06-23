import { describe, expect, it } from 'vitest';

import { registry } from '../registry.js';
import type { EmailTemplate } from '../types.js';

const ALL_TEMPLATES: EmailTemplate[] = [
  'verification',
  'password-reset',
  'venue-activation',
  'payment-confirmation',
  'event-approved',
  'event-rejected',
  'notification',
];

describe('email template registry', () => {
  it.each(ALL_TEMPLATES)('resolves %s to a React component', (template) => {
    expect(registry[template]).toBeDefined();
    expect(typeof registry[template].component).toBe('function');
  });

  it('covers every EmailTemplate key — no unknown gaps', () => {
    expect(Object.keys(registry).sort()).toEqual([...ALL_TEMPLATES].sort());
  });
});
