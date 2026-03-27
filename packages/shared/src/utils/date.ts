export function toISOString(date: Date): string {
  return date.toISOString();
}

export function isEventUpcoming(dateStart: string): boolean {
  return new Date(dateStart) > new Date();
}

export function isEventPast(dateStart: string): boolean {
  return new Date(dateStart) <= new Date();
}

export function formatEventDate(dateStart: string, dateEnd?: string): string {
  const start = new Date(dateStart);
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Dublin',
  };
  const formatted = start.toLocaleDateString('en-IE', options);
  if (!dateEnd) return formatted;
  const end = new Date(dateEnd);
  const endTime = end.toLocaleTimeString('en-IE', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Dublin',
  });
  return `${formatted} – ${endTime}`;
}
