import { format, formatDistanceToNow, isToday, isFuture, isPast } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

const IRELAND_TZ = 'Europe/Dublin';

export function formatEventDate(isoString: string): string {
  const date = toZonedTime(new Date(isoString), IRELAND_TZ);
  return format(date, 'EEE, d MMM · h:mmaaa');
}

export function formatRelativeTime(isoString: string): string {
  return formatDistanceToNow(new Date(isoString), { addSuffix: true });
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
