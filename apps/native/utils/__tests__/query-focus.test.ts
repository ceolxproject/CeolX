import { beforeEach, describe, expect, it, vi } from 'vitest';

const { setFocusedMock, addEventListenerMock, removeMock, handlers } = vi.hoisted(() => {
  const handlers: Array<(state: string) => void> = [];
  return {
    setFocusedMock: vi.fn(),
    removeMock: vi.fn(),
    handlers,
    addEventListenerMock: vi.fn((_event: string, cb: (state: string) => void) => {
      handlers.push(cb);
      return {
        remove: () => {
          removeMock();
        },
      };
    }),
  };
});

vi.mock('react-native', () => ({
  AppState: { addEventListener: addEventListenerMock },
}));
vi.mock('@tanstack/react-query', () => ({
  focusManager: { setFocused: setFocusedMock },
}));

import { installAppStateFocusBridge } from '../query-focus';

describe('installAppStateFocusBridge', () => {
  beforeEach(() => {
    setFocusedMock.mockClear();
    removeMock.mockClear();
    handlers.length = 0;
  });

  it('focuses queries and calls onResume when the app becomes active', () => {
    const onResume = vi.fn();
    installAppStateFocusBridge(onResume);
    handlers[0]('active');
    expect(setFocusedMock).toHaveBeenCalledWith(true);
    expect(onResume).toHaveBeenCalledTimes(1);
  });

  it('does nothing on background / inactive transitions', () => {
    const onResume = vi.fn();
    installAppStateFocusBridge(onResume);
    handlers[0]('background');
    handlers[0]('inactive');
    expect(setFocusedMock).not.toHaveBeenCalled();
    expect(onResume).not.toHaveBeenCalled();
  });

  it('removes the AppState subscription on teardown', () => {
    const teardown = installAppStateFocusBridge(vi.fn());
    teardown();
    expect(removeMock).toHaveBeenCalledTimes(1);
  });
});
