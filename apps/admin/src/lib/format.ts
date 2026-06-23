// Date/time formatting for the admin. Fixed to en-IE (Irish client) so dates
// render consistently regardless of the admin's browser locale. Change LOCALE
// to undefined to fall back to the viewer's browser locale.
const LOCALE = 'en-IE';

type DateInput = string | Date | null | undefined;

function toDate(value: DateInput): Date | null {
  if (!value) return null;
  const d = typeof value === 'string' ? new Date(value) : value;
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(value: DateInput): string {
  const d = toDate(value);
  return d
    ? d.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';
}

export function formatDateTime(value: DateInput): string {
  const d = toDate(value);
  return d
    ? d.toLocaleString(LOCALE, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';
}

export function relativeTime(value: DateInput): string {
  const d = toDate(value);
  if (!d) return 'never';
  const diff = Date.now() - d.getTime();
  const hour = 3_600_000;
  const day = 86_400_000;
  if (diff < hour) return 'just now';
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return formatDate(d);
}
