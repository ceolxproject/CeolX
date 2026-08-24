import { describe, it, expect } from 'vitest';

import {
  getEventStatusLabel,
  getEventStatusColour,
  formatCategory,
  formatTicketPrice,
} from '../events.js';

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

describe('formatTicketPrice', () => {
  it('renders the picked currency symbol', () => {
    expect(formatTicketPrice(1500, 'EUR')).toBe('\u20ac15');
    expect(formatTicketPrice(1500, 'GBP')).toBe('\u00a315');
    expect(formatTicketPrice(1500, 'USD')).toBe('$15');
    expect(formatTicketPrice(1550, 'GBP', 2)).toBe('\u00a315.50');
  });

  it('shows cents only when the price has them', () => {
    // A 25.50 ticket must not read as 26 — that misquotes the price to the fan.
    expect(formatTicketPrice(2550, 'GBP')).toBe('\u00a325.50');
    expect(formatTicketPrice(1999, 'EUR')).toBe('\u20ac19.99');
    expect(formatTicketPrice(1500, 'GBP')).toBe('\u00a315');
    // An explicit width still wins (admin sheet always shows cents).
    expect(formatTicketPrice(1500, 'GBP', 2)).toBe('\u00a315.00');
  });

  it('falls back to euro for legacy rows with no currency', () => {
    expect(formatTicketPrice(1500, null)).toBe('\u20ac15');
    expect(formatTicketPrice(1500, 'XYZ')).toBe('\u20ac15');
  });

  it('keeps the free / unknown cases', () => {
    expect(formatTicketPrice(0, 'USD')).toBe('Free');
    expect(formatTicketPrice(null, 'USD')).toBe('\u2014');
  });
});
