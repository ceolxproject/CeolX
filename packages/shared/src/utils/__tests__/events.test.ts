import { describe, it, expect } from 'vitest';

import { getEventStatusLabel, getEventStatusColour, formatCategory } from '../events.js';

describe('getEventStatusLabel', () => {
  it('returns human-readable labels', () => {
    expect(getEventStatusLabel('draft')).toBe('Draft');
    expect(getEventStatusLabel('pending_review')).toBe('Pending Review');
    expect(getEventStatusLabel('active')).toBe('Live');
    expect(getEventStatusLabel('rejected')).toBe('Rejected');
    expect(getEventStatusLabel('archived')).toBe('Archived');
  });
});

describe('getEventStatusColour', () => {
  it('returns hex colour for each status', () => {
    expect(getEventStatusColour('active')).toBe('#662FFF');
    expect(getEventStatusColour('pending_review')).toBe('#F59E0B');
    expect(getEventStatusColour('rejected')).toBe('#EF4444');
    expect(getEventStatusColour('archived')).toBe('#8D8D8D');
    expect(getEventStatusColour('draft')).toBe('#662FFF');
  });
});

describe('formatCategory', () => {
  it('converts underscore_case to Title Case', () => {
    expect(formatCategory('trad_session')).toBe('Trad Session');
    expect(formatCategory('Traditional')).toBe('Traditional');
    expect(formatCategory('folk_music_event')).toBe('Folk Music Event');
  });
});
