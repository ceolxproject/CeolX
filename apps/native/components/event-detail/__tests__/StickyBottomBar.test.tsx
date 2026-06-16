import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mocks ----------------------------------------------------------------
// vi.hoisted keeps the spies referenceable inside the hoisted vi.mock factories
// without lazy wrappers (which would leak `any` through the mock boundary).
const { mutate, openBrowserAsync, alert } = vi.hoisted(() => ({
  mutate: vi.fn(),
  openBrowserAsync: vi.fn(),
  alert: vi.fn(),
}));

vi.mock('@/hooks/use-track-ticket-click', () => ({
  useTrackTicketClick: () => ({ mutate }),
}));

vi.mock('expo-web-browser', () => ({ openBrowserAsync }));

vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Alert: { alert },
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
  alert.mockClear();
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

  it('alerts the user when the browser fails to open', async () => {
    openBrowserAsync.mockRejectedValueOnce(new Error('no handler'));
    const tree = StickyBottomBar({ ...baseProps, ticketLink: 'https://tix.ie/e' });
    const bookBtn = collect(tree, 'Pressable').find((p) =>
      textContent(p.props?.children).includes('Book Ticket')
    );
    await bookBtn?.props?.onPress?.();

    expect(alert).toHaveBeenCalled();
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
});
