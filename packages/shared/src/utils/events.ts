import { EventStatus } from '../enums.js';

/**
 * Statuses an event can hold while it is still a live, interactable target for
 * collaboration/booking flows. Anything outside this set ("archived" =
 * creator-deleted, "removed" = admin takedown) means the event is gone and its
 * request/collaboration cards must show a disabled tombstone state — and the
 * server must reject any further booking actions against it.
 * Asana 1215700058852004.
 */
const COLLABORATABLE_EVENT_STATUSES: readonly EventStatus[] = [
  EventStatus.ACTIVE,
  EventStatus.PENDING_REVIEW,
];

/**
 * True when an event has been deleted (creator-archived) or taken down (admin
 * removed) and should no longer be openable/actionable from collaboration or
 * booking request surfaces. Used by both the API guard and the native cards so
 * the "Event no longer available" rule stays defined in one place.
 */
export function isEventUnavailableForCollaboration(status: EventStatus): boolean {
  return !COLLABORATABLE_EVENT_STATUSES.includes(status);
}

export function getEventStatusLabel(status: EventStatus): string {
  const labels: Record<EventStatus, string> = {
    draft: 'Draft',
    pending_review: 'Pending Review',
    active: 'Live',
    rejected: 'Rejected',
    archived: 'Archived',
    removed: 'Removed',
  };
  return labels[status];
}

export function getEventStatusColour(status: EventStatus): string {
  const colours: Record<EventStatus, string> = {
    draft: '#662FFF',
    pending_review: '#F59E0B',
    active: '#662FFF',
    rejected: '#EF4444',
    archived: '#8D8D8D',
    removed: '#DC2626',
  };
  return colours[status];
}

export function formatCategory(category: string): string {
  return category.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const lastSpace = text.lastIndexOf(' ', maxLength);
  if (lastSpace === -1) return text.slice(0, maxLength) + '…';
  return text.slice(0, lastSpace) + '…';
}
