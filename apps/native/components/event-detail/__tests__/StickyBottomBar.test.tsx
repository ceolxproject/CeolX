import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mocks ----------------------------------------------------------------
// vi.hoisted keeps the spies referenceable inside the hoisted vi.mock factories
// without lazy wrappers (which would leak `any` through the mock boundary).
const { mutate, openBrowserAsync, toastError } = vi.hoisted(() => ({
  mutate: vi.fn(),
  openBrowserAsync: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@/hooks/use-track-ticket-click', () => ({
  useTrackTicketClick: () => ({ mutate }),
}));

vi.mock('expo-web-browser', () => ({ openBrowserAsync }));
// analytics.ts imports @sentry/react-native, which re-exports the real
// react-native and fails to parse under vitest. Mocked here so the ticket-click
// PostHog capture doesn't drag it into a component test.
vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
  AnalyticsEvent: { TICKET_LINK_CLICKED: 'ticket_link_clicked' },
}));

vi.mock('@/components/AppToast', () => ({
  appToast: { success: vi.fn(), error: toastError, info: vi.fn(), warning: vi.fn() },
}));

vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Pressable: 'Pressable',
  Text: 'Text',
  View: 'View',
}));

vi.mock('heroui-native', () => ({
  cn: (...classes: unknown[]) => classes.filter(Boolean).join(' '),
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

import { StickyBottomBar } from '../StickyBottomBar';

// --- Tree helpers ---------------------------------------------------------
type El = { type: unknown; props?: { children?: unknown; onPress?: () => void | Promise<void> } };

function collect(node: unknown, type: string, acc: El[] = []): El[] {
  if (!node || typeof node !== 'object') return acc;
  if (Array.isArray(node)) {
    for (const child of node) collect(child, type, acc);
    return acc;
  }
  const el = node as El;
  if (el.type === type) acc.push(el);
  if (el.props?.children) collect(el.props.children, type, acc);
  return acc;
}

function textContent(node: unknown): string {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(textContent).join('');
  if (node && typeof node === 'object') return textContent((node as El).props?.children);
  return '';
}

const baseProps = {
  eventId: 'evt-1',
  ticketPrice: 9900,
  ticketLink: null as string | null,
  isArtist: false,
  isOwner: false,
  isVenueEvent: false,
  onRequestToPerform: vi.fn(),
};

beforeEach(() => {
  mutate.mockClear();
  toastError.mockClear();
  openBrowserAsync.mockReset();
  openBrowserAsync.mockResolvedValue(undefined);
});

describe('StickyBottomBar', () => {
  it('renders nothing when a spectator has no ticket link and no other action', () => {
    // Priced event but no link → the button must not appear (the original bug).
    expect(StickyBottomBar(baseProps)).toBeNull();
  });

  it('renders the Book Ticket button only when a ticket link exists', () => {
    const tree = StickyBottomBar({ ...baseProps, ticketLink: 'https://tix.ie/e' });
    const bookBtn = collect(tree, 'Pressable').find((p) =>
      textContent(p.props?.children).includes('Book Ticket')
    );
    expect(bookBtn).toBeDefined();
  });

  it('prices the CTA in the currency the creator picked', () => {
    const label = (
      props: Partial<Omit<typeof baseProps, 'ticketPrice'>> & {
        ticketPrice?: number | null;
        ticketCurrency?: string | null;
      }
    ) => {
      const tree = StickyBottomBar({ ...baseProps, ticketLink: 'https://tix.ie/e', ...props });
      return collect(tree, 'Pressable')
        .map((p) => textContent(p.props?.children))
        .find((t) => t.includes('Book Ticket'));
    };

    expect(label({ ticketCurrency: 'GBP' })).toContain('\u00a399');
    expect(label({ ticketCurrency: 'USD' })).toContain('$99');
    // Legacy rows carry no currency — they stay euro rather than losing the symbol.
    expect(label({ ticketCurrency: null })).toContain('\u20ac99');
    // Cents survive: a 25.50 ticket must not advertise as 26.
    expect(label({ ticketPrice: 2550, ticketCurrency: 'USD' })).toContain('$25.50');
    // No price → no amount in the label at all.
    expect(label({ ticketPrice: null })).toBe('Book Ticket');
  });

  it('opens the normalized link in an in-app browser and tracks the click', async () => {
    // Bare domain (no scheme) must still open — normalized to https://.
    const tree = StickyBottomBar({ ...baseProps, ticketLink: 'tix.ie/e/99' });
    const bookBtn = collect(tree, 'Pressable').find((p) =>
      textContent(p.props?.children).includes('Book Ticket')
    );
    await bookBtn?.props?.onPress?.();

    expect(mutate).toHaveBeenCalledWith({ id: 'evt-1' });
    expect(openBrowserAsync).toHaveBeenCalledWith('https://tix.ie/e/99');
  });

  it('toasts the user when the browser fails to open', async () => {
    openBrowserAsync.mockRejectedValueOnce(new Error('no handler'));
    const tree = StickyBottomBar({ ...baseProps, ticketLink: 'https://tix.ie/e' });
    const bookBtn = collect(tree, 'Pressable').find((p) =>
      textContent(p.props?.children).includes('Book Ticket')
    );
    await bookBtn?.props?.onPress?.();

    expect(toastError).toHaveBeenCalled();
  });

  it('hides Book Ticket for a spectator once the event has passed', () => {
    // Ticket-buying only makes sense for events still ahead of the viewer —
    // once isPastEvent is true, the CTA must not render even with a valid link.
    const tree = StickyBottomBar({
      ...baseProps,
      ticketLink: 'https://tix.ie/e',
      isPastEvent: true,
    });
    expect(tree).toBeNull();
  });

  it('shows Request to Perform (not Book Ticket) for an artist on a linkless venue event', () => {
    const tree = StickyBottomBar({
      ...baseProps,
      ticketLink: null,
      isArtist: true,
      isVenueEvent: true,
    });
    const labels = collect(tree, 'Pressable').map((p) => textContent(p.props?.children));
    expect(labels.some((l) => l.includes('Request to Perform'))).toBe(true);
    expect(labels.some((l) => l.includes('Book Ticket'))).toBe(false);
  });

  // ── Request state contract (Asana 1215700058851990, bugs #4/#5) ────────────
  // The button shown is driven entirely by `hasExistingRequest`. A withdrawn
  // request flips the server's viewerHasPendingRequest to false, so the artist
  // must get an actionable "Request to Perform" back — never a stuck "Request
  // Sent" placeholder.

  it('shows the disabled Request Sent state while a request is pending', () => {
    const tree = StickyBottomBar({
      ...baseProps,
      isArtist: true,
      isVenueEvent: true,
      hasExistingRequest: true,
    });
    const allLabels = [
      ...collect(tree, 'Pressable').map((p) => textContent(p.props?.children)),
      ...collect(tree, 'View').map((v) => textContent(v.props?.children)),
    ];
    expect(allLabels.some((l) => l.includes('Request Sent'))).toBe(true);
    // The actionable button must NOT be present while pending.
    const pressableLabels = collect(tree, 'Pressable').map((p) => textContent(p.props?.children));
    expect(pressableLabels.some((l) => l.includes('Request to Perform'))).toBe(false);
  });

  it('restores the actionable Request to Perform button once the request is gone (withdrawn)', () => {
    const tree = StickyBottomBar({
      ...baseProps,
      isArtist: true,
      isVenueEvent: true,
      hasExistingRequest: false,
    });
    const pressableLabels = collect(tree, 'Pressable').map((p) => textContent(p.props?.children));
    expect(pressableLabels.some((l) => l.includes('Request to Perform'))).toBe(true);
  });
});
