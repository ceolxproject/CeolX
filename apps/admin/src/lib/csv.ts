/**
 * Tiny RFC 4180-ish CSV builder for the admin users export.
 *
 * - Wraps a UTF-8 BOM so Excel detects encoding (Irish names like "Siobhán"
 *   render correctly without manual import settings).
 * - Uses CRLF line endings (RFC 4180).
 * - Escapes commas, double quotes, and newlines.
 *
 * Stays in-app (no papaparse dep) — at <1k user scale a 10-line builder is
 * cheaper than a 30kB library.
 */

const UTF8_BOM = '﻿';
const FIELD_SEP = ',';
const LINE_SEP = '\r\n';

type FieldValue = string | number | boolean | null | undefined;

export function escapeCsvField(value: FieldValue): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function buildCsv(
  columns: readonly string[],
  rows: readonly Record<string, FieldValue>[]
): string {
  const header = columns.map(escapeCsvField).join(FIELD_SEP);
  const body = rows
    .map((row) => columns.map((col) => escapeCsvField(row[col])).join(FIELD_SEP))
    .join(LINE_SEP);
  if (rows.length === 0) {
    return `${UTF8_BOM}${header}${LINE_SEP}`;
  }
  return `${UTF8_BOM}${header}${LINE_SEP}${body}${LINE_SEP}`;
}

export function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
