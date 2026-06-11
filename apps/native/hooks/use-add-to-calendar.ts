import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';

export type CalendarEventInput = {
  title: string;
  startDate: Date;
  endDate: Date;
  notes?: string;
  location?: string;
};

/** Thrown when the user declines the OS calendar-permission prompt. */
export const CALENDAR_PERMISSION_DENIED = 'calendar-permission-denied';

/**
 * Thrown when the device has no cloud-synced calendar to write to. On Android
 * this means no Google (or other synced) account is set up in the OS — only a
 * local, device-only calendar exists, which would never reach Google Calendar.
 * The caller should prompt the user to connect an account.
 */
export const CALENDAR_NO_SYNCED_ACCOUNT = 'calendar-no-synced-account';

/**
 * Adds an event to the device's native calendar.
 *
 * Replaces the old Google-Calendar *web* deep link, which dead-ended with a
 * "no calendar synced" message on devices without a Google account. Here we
 * request permission, resolve the user's cloud-synced calendar, then write the
 * event.
 *
 * @returns the created event's id
 * @throws Error(CALENDAR_PERMISSION_DENIED) when permission is declined
 * @throws Error(CALENDAR_NO_SYNCED_ACCOUNT) when no cloud-synced calendar exists
 *         (the caller surfaces a "connect a Google account" prompt). Other
 *         errors bubble up for the caller to surface via toast.
 */
export async function addEventToDeviceCalendar(input: CalendarEventInput): Promise<string> {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  if (status !== Calendar.PermissionStatus.GRANTED) {
    throw new Error(CALENDAR_PERMISSION_DENIED);
  }

  const calendarId = await resolveTargetCalendarId();

  return Calendar.createEventAsync(calendarId, {
    title: input.title,
    startDate: input.startDate,
    endDate: input.endDate,
    notes: input.notes,
    location: input.location,
  });
}

/**
 * Resolves the calendar the event should be written to.
 *
 * Android subtlety: `getCalendarsAsync` returns Google account calendars, local
 * (device-only) calendars, and read-only ones together, in no guaranteed order.
 * Writing to a *local* calendar succeeds but the event never syncs to Google —
 * the bug behind "added but not showing in Google Calendar". So we must pick a
 * cloud-synced, non-local, writable calendar, preferring the primary Google one.
 */
async function resolveTargetCalendarId(): Promise<string> {
  if (Platform.OS === 'ios') {
    const defaultCalendar = await Calendar.getDefaultCalendarAsync();
    if (defaultCalendar?.allowsModifications) return defaultCalendar.id;

    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    const writable = calendars.find((cal) => cal.allowsModifications);
    if (writable) return writable.id;

    throw new Error(CALENDAR_NO_SYNCED_ACCOUNT);
  }

  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);

  // Only cloud-synced, writable, non-local calendars can reach Google Calendar.
  const syncable = calendars.filter(
    (cal) =>
      cal.allowsModifications && cal.source?.isLocalAccount !== true && cal.isSynced !== false
  );

  // Prefer the user's primary Google calendar, then any Google calendar, then
  // any primary synced calendar, then the first remaining syncable one.
  const target =
    syncable.find((cal) => String(cal.source?.type) === 'com.google' && cal.isPrimary) ??
    syncable.find((cal) => String(cal.source?.type) === 'com.google') ??
    syncable.find((cal) => cal.isPrimary) ??
    syncable[0];

  if (!target) {
    // No Google/synced account on the device — a local calendar would never
    // sync, so we surface this instead of silently writing to a dead end.
    throw new Error(CALENDAR_NO_SYNCED_ACCOUNT);
  }

  return target.id;
}
