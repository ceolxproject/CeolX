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
 * Adds an event to the device's native calendar.
 *
 * Replaces the old Google-Calendar *web* deep link, which dead-ended with a
 * "no calendar synced" message on devices without a Google account. Here we
 * request permission, resolve a writable calendar — creating a local "CeolX"
 * one if the device has none — then write the event. The user is never blocked.
 *
 * @returns the created event's id
 * @throws Error(CALENDAR_PERMISSION_DENIED) when permission is declined; other
 *         errors bubble up for the caller to surface via toast.
 */
export async function addEventToDeviceCalendar(input: CalendarEventInput): Promise<string> {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  if (status !== Calendar.PermissionStatus.GRANTED) {
    throw new Error(CALENDAR_PERMISSION_DENIED);
  }

  const calendarId = await resolveWritableCalendarId();

  return Calendar.createEventAsync(calendarId, {
    title: input.title,
    startDate: input.startDate,
    endDate: input.endDate,
    notes: input.notes,
    location: input.location,
  });
}

/** Finds a writable calendar, falling back to creating a local one. */
async function resolveWritableCalendarId(): Promise<string> {
  if (Platform.OS === 'ios') {
    const defaultCalendar = await Calendar.getDefaultCalendarAsync();
    if (defaultCalendar?.allowsModifications) return defaultCalendar.id;
  }

  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const writable = calendars.find((cal) => cal.allowsModifications);
  if (writable) return writable.id;

  // No writable calendar on the device (e.g. no account synced on Android) —
  // create a local one so "Add to calendar" always works.
  return createLocalCalendar();
}

async function createLocalCalendar(): Promise<string> {
  const source =
    Platform.OS === 'ios'
      ? (await Calendar.getDefaultCalendarAsync()).source
      : { isLocalAccount: true, name: 'CeolX', type: Calendar.SourceType.LOCAL };

  return Calendar.createCalendarAsync({
    title: 'CeolX',
    name: 'CeolX',
    color: '#662FFE',
    entityType: Calendar.EntityTypes.EVENT,
    source,
    ownerAccount: 'CeolX',
    accessLevel: Calendar.CalendarAccessLevel.OWNER,
  });
}
