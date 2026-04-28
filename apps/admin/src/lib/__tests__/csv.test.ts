import { describe, expect, it } from 'vitest';

import { buildCsv, downloadCsv, escapeCsvField } from '../csv';

describe('escapeCsvField', () => {
  it('returns plain values unchanged', () => {
    expect(escapeCsvField('plain')).toBe('plain');
  });

  it('quotes fields containing a comma', () => {
    expect(escapeCsvField('a,b')).toBe('"a,b"');
  });

  it('quotes fields containing a double quote and doubles the quote', () => {
    expect(escapeCsvField('he said "hi"')).toBe('"he said ""hi"""');
  });

  it('quotes fields containing a newline', () => {
    expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"');
  });

  it('quotes fields containing a carriage return', () => {
    expect(escapeCsvField('line1\rline2')).toBe('"line1\rline2"');
  });

  it('preserves UTF-8 characters as-is (Irish names like Siobhán)', () => {
    expect(escapeCsvField('Siobhán')).toBe('Siobhán');
  });

  it('renders booleans as their string form', () => {
    expect(escapeCsvField(true)).toBe('true');
    expect(escapeCsvField(false)).toBe('false');
  });

  it('renders null and undefined as empty strings', () => {
    expect(escapeCsvField(null)).toBe('');
    expect(escapeCsvField(undefined)).toBe('');
  });

  it('renders numbers as their string form', () => {
    expect(escapeCsvField(42)).toBe('42');
  });
});

describe('buildCsv', () => {
  it('produces a header line followed by data lines', () => {
    const csv = buildCsv(
      ['name', 'email'],
      [
        { name: 'Alice', email: 'a@b.com' },
        { name: 'Bob', email: 'b@c.com' },
      ]
    );
    expect(csv).toBe('﻿name,email\r\nAlice,a@b.com\r\nBob,b@c.com\r\n');
  });

  it('prepends the UTF-8 BOM so Excel detects encoding correctly', () => {
    const csv = buildCsv(['name'], [{ name: 'Siobhán' }]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it('escapes commas, quotes, and newlines inside cells', () => {
    const csv = buildCsv(['note'], [{ note: 'a, "b", and\nc' }]);
    expect(csv).toBe('﻿note\r\n"a, ""b"", and\nc"\r\n');
  });

  it('renders empty array as just the header row', () => {
    const csv = buildCsv(['col'], []);
    expect(csv).toBe('﻿col\r\n');
  });

  it('emits empty cells when row is missing a column', () => {
    const csv = buildCsv(['name', 'email'], [{ name: 'Alice' }]);
    expect(csv).toBe('﻿name,email\r\nAlice,\r\n');
  });
});

describe('downloadCsv (smoke)', () => {
  it('exists as a function', () => {
    expect(typeof downloadCsv).toBe('function');
  });
});
