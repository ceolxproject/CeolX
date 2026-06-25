import { format, formatDistanceToNow, isToday, isYesterday, isFuture, isPast } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

const IRELAND_TZ = 'Europe/Dublin';

const MINUTE_SECONDS = 60;
const HOUR_SECONDS = 60 * MINUTE_SECONDS;
const DAY_SECONDS = 24 * HOUR_SECONDS;

export function formatEventDate(isoString: string): string {
  const date = toZonedTime(new Date(isoString), IRELAND_TZ);
  return format(date, 'EEE, d MMM · h:mmaaa');
}

export function formatRelativeTime(isoString: string): string {
  return formatDistanceToNow(new Date(isoString), { addSuffix: true });
}

/**
 * Compact, feed-friendly published-at label for post cards.
 *
 * Recent posts read as a clean relative time ("Just now", "5 minutes ago",
 * "2 hours ago", "Yesterday"); anything 2+ days old switches to an absolute
 * Irish-time date ("15 Jun 2026") so spectators can gauge freshness without
 * vague "3 months ago" strings. Future timestamps (clock skew) clamp to
 * "Just now" rather than rendering a negative distance.
 */
export function formatPostTimestamp(isoString: string): string {
  const date = new Date(isoString);
  const diffSeconds = (Date.now() - date.getTime()) / 1000;

  if (diffSeconds < MINUTE_SECONDS) return 'Just now';

  if (diffSeconds < HOUR_SECONDS) {
    const minutes = Math.floor(diffSeconds / MINUTE_SECONDS);
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
  }

  if (diffSeconds < DAY_SECONDS) {
    const hours = Math.floor(diffSeconds / HOUR_SECONDS);
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  }

  if (isYesterday(date)) return 'Yesterday';

  return format(toZonedTime(date, IRELAND_TZ), 'd MMM yyyy');
}

export function formatDateRange(start: string, end?: string): string {
  const s = toZonedTime(new Date(start), IRELAND_TZ);
  if (!end) return format(s, 'd MMM yyyy');
  const e = toZonedTime(new Date(end), IRELAND_TZ);
  if (format(s, 'MMM yyyy') === format(e, 'MMM yyyy')) {
    return `${format(s, 'd')}–${format(e, 'd MMM yyyy')}`;
  }
  return `${format(s, 'd MMM')} – ${format(e, 'd MMM yyyy')}`;
}

export function isEventUpcoming(dateStart: string): boolean {
  return isFuture(new Date(dateStart));
}

export function isEventPast(dateStart: string): boolean {
  return isPast(new Date(dateStart));
}

export function isEventToday(dateStart: string): boolean {
  return isToday(new Date(dateStart));
}
