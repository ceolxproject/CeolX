import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

const IRELAND_TZ = 'Europe/Dublin';

// Short, push-body-friendly date label e.g. "Fri 1 May".
// Used by notification trigger builders — see ./triggers.ts. Distinct from
// the longer formatEventDate (which adds time + comma) used in feed/UI.
export function formatNotificationDate(date: Date): string {
  return format(toZonedTime(date, IRELAND_TZ), 'EEE d MMM');
}
