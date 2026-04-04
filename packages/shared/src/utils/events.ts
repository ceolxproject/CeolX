import type { EventStatus } from '../enums.js';

export function getEventStatusLabel(status: EventStatus): string {
  const labels: Record<EventStatus, string> = {
    draft: 'Draft',
    pending_review: 'Pending Review',
    active: 'Live',
    rejected: 'Rejected',
    archived: 'Archived',
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
