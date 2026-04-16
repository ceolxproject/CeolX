/**
 * Formats an event's date range for card display.
 * e.g. "Apr 14, 7:00 pm" or "Apr 14, 7:00 pm-10:00 pm"
 */
export function formatEventDate(dateStart: string, dateEnd?: string): string {
  const start = new Date(dateStart);
  const month = start.toLocaleString('en-IE', { month: 'short' });
  const day = start.getDate();
  const time = start.toLocaleString('en-IE', { hour: 'numeric', minute: '2-digit', hour12: true });

  if (dateEnd) {
    const end = new Date(dateEnd);
    const endTime = end.toLocaleString('en-IE', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    return `${month} ${day}, ${time}-${endTime}`;
  }

  return `${month} ${day}, ${time}`;
}
