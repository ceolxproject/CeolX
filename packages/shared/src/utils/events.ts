import {
  DEFAULT_TICKET_CURRENCY,
  EventStatus,
  TICKET_CURRENCIES,
  type TicketCurrency,
} from '../enums.js';

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

const CURRENCY_SYMBOLS: Record<TicketCurrency, string> = {
  EUR: '\u20ac',
  GBP: '\u00a3',
  USD: '$',
};

/**
 * Narrow a stored currency code to one the app actually offers.
 *
 * Legacy rows predate the column and raw SQL can write anything, so every reader
 * needs the same fallback — owning it here keeps the display helpers and the edit
 * form from drifting apart on what "unknown currency" means.
 */
export function toTicketCurrency(currency?: string | null): TicketCurrency {
  return TICKET_CURRENCIES.includes(currency as TicketCurrency)
    ? (currency as TicketCurrency)
    : DEFAULT_TICKET_CURRENCY;
}

/** Symbol for a stored currency code, falling back to EUR for legacy/unknown rows. */
export function currencySymbol(currency?: string | null): string {
  return CURRENCY_SYMBOLS[toTicketCurrency(currency)];
}

/**
 * Ticket price for display. Cents in, symbol + amount out, with the currency the
 * creator picked on the event form — every price surface (event detail, sticky
 * book button, admin sheet) reads it from here so a GBP event never renders as €.
 *
 * Cents are shown only when the price actually has them: a £25.50 ticket must not
 * read as £26 (what a flat toFixed(0) did — it misquoted the price to the fan),
 * while a £15 ticket stays £15 rather than the noisier £15.00. Pass `decimals` to
 * force a fixed width, as the admin sheet does.
 */
export function formatTicketPrice(
  cents: number | null | undefined,
  currency?: string | null,
  decimals?: number
): string {
  if (cents === null || cents === undefined) return '—';
  // `<= 0`, not `=== 0`: there is no DB CHECK behind ticket_price, so a bad
  // backfill or a write path that skips the validator can leave a negative here.
  // Rendering that as '-£5.00' is worse than reading it as free.
  if (cents <= 0) return 'Free';
  const places = decimals ?? (cents % 100 === 0 ? 0 : 2);
  return `${currencySymbol(currency)}${(cents / 100).toFixed(places)}`;
}
